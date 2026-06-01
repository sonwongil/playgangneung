import axios from "axios";
import https from "https";
import * as cheerio from "cheerio";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, blogSourcesTable } from "@workspace/db";
import { logger } from "./logger.js";
import { readSources } from "./sources.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export interface CrawledStory {
  id: string;
  title: string;
  body: string;
  images: string[];
  sourceUrl: string;
  author: string;
  tags: string[];
}

function makeId(ns: string, val: string): string {
  return crypto.createHash("md5").update(`${ns}:${val}`).digest("hex").slice(0, 16);
}

async function fetchXml(url: string, timeoutMs = 12000): Promise<string> {
  const resp = await axios.get(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml,application/xml,text/xml,*/*",
      "Accept-Language": "ko-KR,ko;q=0.9",
      Referer: "https://blog.naver.com/",
    },
    httpsAgent,
    timeout: timeoutMs,
    responseType: "arraybuffer",
    maxRedirects: 5,
  });
  const buf = Buffer.from(resp.data as ArrayBuffer);
  const rawLatin = buf.toString("latin1");
  const isEucKr = /charset=["']?(euc-kr|ks_c_5601)/i.test(rawLatin);
  if (isEucKr) {
    const { default: iconv } = await import("iconv-lite");
    return iconv.decode(buf, "euc-kr");
  }
  return buf.toString("utf-8");
}

const GANGNEUNG_KEYWORDS = /강릉|경포|주문진|사천|옥계|성산|구정|연곡|왕산|강동|노암|포남|교동|남문|내곡|홍제|성내|임당|옥천|강릉시/;
const JUNK = /이메일.*자동수집|정보통신망법|저작권|무단전재|copyright|all rights reserved/i;

/** RSS / HTML 내 이미지를 최대 maxCount장까지 추출 (프로필·아이콘 제외, blur→고해상도 치환) */
function extractImagesFromHtml(html: string, maxCount = 5): string[] {
  const seen = new Set<string>();
  const imgs: string[] = [];
  // data-lazy-src 우선, 없으면 src
  const lazyMatches = html.matchAll(/data-lazy-src=["']([^"']+\.(jpg|jpeg|png|webp)[^"']*)/gi);
  for (const m of lazyMatches) {
    const url = normalizeImgUrl(m[1]);
    if (url && !seen.has(url)) { seen.add(url); imgs.push(url); }
    if (imgs.length >= maxCount) return imgs;
  }
  const srcMatches = html.matchAll(/\bsrc=["']([^"']+\.(jpg|jpeg|png|webp)[^"']*)/gi);
  for (const m of srcMatches) {
    const url = normalizeImgUrl(m[1]);
    if (url && !seen.has(url)) { seen.add(url); imgs.push(url); }
    if (imgs.length >= maxCount) return imgs;
  }
  return imgs;
}

/** 섬네일 URL을 w800 고해상도로 정규화하고 프로필/아이콘은 제거 */
function normalizeImgUrl(raw: string): string | null {
  // 프로필·스토어 아이콘 제외 (dthumb-phinf는 일반 콘텐츠 이미지에도 사용되므로 제외 안 함)
  if (/blogpfthumb|storep-phinf|type=p\d|\.gif/i.test(raw)) return null;
  // blur 저해상도 → w800 고해상도
  let url = raw.replace(/type=w\d+_blur$/i, "type=w800").replace(/type=s3$/i, "type=w800");
  return url;
}

/** 네이버 블로그 포스트에서 이미지 추출 (모바일 HTML) */
export async function fetchNaverBlogImages(postUrl: string, maxCount = 5): Promise<string[]> {
  try {
    // m.blog.naver.com 모바일 URL로 변환
    const mobileUrl = postUrl
      .replace("blog.naver.com", "m.blog.naver.com")
      .split("?")[0]; // fromRss 파라미터 제거
    const resp = await axios.get(mobileUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        "Accept-Language": "ko-KR,ko;q=0.9",
        Referer: "https://m.blog.naver.com/",
      },
      httpsAgent,
      timeout: 8000,
    });
    return extractImagesFromHtml(resp.data as string, maxCount);
  } catch {
    return [];
  }
}

function parseRss(
  xmlStr: string,
  sourceName: string,
  defaultTags: string[],
  strictFilter = true,
): CrawledStory[] {
  const $ = cheerio.load(xmlStr, { xmlMode: true });
  const stories: CrawledStory[] = [];

  $("item").each((_, el) => {
    const $el = $(el);
    const title = $el.find("title").first().text().replace(/<!\[CDATA\[|\]\]>/g, "").trim();

    let link = $el.find("link").first().text().trim();
    if (!link) link = $el.find("guid").first().text().trim();

    const rawDesc = $el.find("description").first().text().replace(/<!\[CDATA\[|\]\]>/g, "");
    const desc = rawDesc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);

    const pubDate = $el.find("pubDate, dc\\:date, published").first().text().trim();

    if (!title || !link) return;

    if (strictFilter && !GANGNEUNG_KEYWORDS.test(title + " " + desc)) return;
    if (JUNK.test(desc)) return;

    // 이미지 추출: enclosure → content:encoded → description 순서로 최대 5장
    const encUrl = $el.find("enclosure[type^='image']").attr("url");
    const encoded = $el.find("content\\:encoded, encoded").first().text();
    const combined = (encUrl ? `src="${encUrl}" ` : "") + encoded + " " + rawDesc;
    const images = extractImagesFromHtml(combined, 5);

    stories.push({
      id: makeId("story", link),
      title,
      body: desc,
      images,
      sourceUrl: link,
      author: sourceName,
      tags: [...defaultTags, pubDate ? new Date(pubDate).getFullYear().toString() : ""].filter(Boolean),
    });
  });

  return stories;
}

// ─── 기본 RSS 소스 ────────────────────────────────────────────────────────────
const DEFAULT_STORY_SOURCES: { name: string; url: string; tags: string[]; strictFilter: boolean }[] = [
  {
    name: "강원도민일보 강릉",
    url: "https://cdn.kado.net/rss/gn_rss_allArticle.xml",
    tags: ["강릉", "지역소식"],
    strictFilter: true,
  },
];

// ─── 네이버 블로그 소스 CRUD ─────────────────────────────────────────────────

export function blogIdFromUrl(input: string): string {
  input = input.trim();
  try {
    const u = new URL(input);
    if (u.hostname.includes("blog.naver.com")) {
      return u.pathname.replace(/^\//, "").split("/")[0];
    }
    if (u.hostname.includes("rss.blog.naver.com")) {
      return u.pathname.replace(/^\//, "").replace(/\.xml$/, "");
    }
  } catch { /* raw blogId */ }
  return input.replace(/\.xml$/, "");
}

export async function listBlogSources() {
  return db.select().from(blogSourcesTable).orderBy(blogSourcesTable.createdAt);
}

export async function addBlogSource(name: string, blogIdOrUrl: string) {
  const blogId = blogIdFromUrl(blogIdOrUrl);
  if (!blogId) throw new Error("블로그 ID를 인식할 수 없습니다");
  const id = crypto.createHash("md5").update(`blog:${blogId}`).digest("hex").slice(0, 16);
  const [row] = await db
    .insert(blogSourcesTable)
    .values({ id, name: name || blogId, blogId, enabled: true, createdAt: new Date() })
    .onConflictDoNothing()
    .returning();
  return row;
}

export async function deleteBlogSource(id: string) {
  const result = await db.delete(blogSourcesTable).where(eq(blogSourcesTable.id, id));
  return (result.rowCount ?? 0) > 0;
}

export async function toggleBlogSource(id: string, enabled: boolean) {
  const result = await db.update(blogSourcesTable).set({ enabled }).where(eq(blogSourcesTable.id, id));
  return (result.rowCount ?? 0) > 0;
}

// ─── 전체 스토리 크롤링 ──────────────────────────────────────────────────────

export async function crawlStories(): Promise<{ stories: CrawledStory[]; errors: string[] }> {
  const all: CrawledStory[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();

  // DB crawl_sources 중 RSS URL 재활용
  let dbRssSources: { name: string; url: string; tags: string[]; strictFilter: boolean }[] = [];
  try {
    const sources = await readSources();
    dbRssSources = sources
      .filter((s) => s.enabled && (s.url.includes(".xml") || /\/rss[/?]/.test(s.url)))
      .map((s) => ({ name: s.name, url: s.url, tags: ["지역소식"], strictFilter: true }));
  } catch (err) {
    logger.warn({ err }, "DB 소스 로드 실패, 기본 소스만 사용");
  }

  const allRssSources = [
    ...DEFAULT_STORY_SOURCES,
    ...dbRssSources.filter((ds) => !DEFAULT_STORY_SOURCES.some((def) => def.url === ds.url)),
  ];

  // 일반 RSS 수집
  for (const src of allRssSources) {
    try {
      const xml = await fetchXml(src.url);
      const items = parseRss(xml, src.name, src.tags, src.strictFilter);
      for (const s of items) {
        if (!seenIds.has(s.id)) { seenIds.add(s.id); all.push(s); }
      }
      logger.info({ source: src.name, count: items.length }, "스토리 RSS 완료");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ source: src.name, err: msg }, "스토리 RSS 실패 (정상)");
      errors.push(`${src.name}: ${msg.slice(0, 80)}`);
    }
  }

  // 네이버 블로그 수집
  let blogSources: { id: string; name: string; blogId: string; enabled: boolean }[] = [];
  try {
    blogSources = await db
      .select()
      .from(blogSourcesTable)
      .where(eq(blogSourcesTable.enabled, true));
  } catch (err) {
    logger.warn({ err }, "블로그 소스 로드 실패");
  }

  for (const blog of blogSources) {
    const rssUrl = `https://rss.blog.naver.com/${blog.blogId}.xml`;
    try {
      const xml = await fetchXml(rssUrl);
      const items = parseRss(xml, `네이버 블로그 · ${blog.name}`, ["강릉", "블로그"], false);
      for (const s of items) {
        if (!seenIds.has(s.id)) { seenIds.add(s.id); all.push(s); }
      }
      logger.info({ blog: blog.blogId, count: items.length }, "네이버 블로그 RSS 완료");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ blog: blog.blogId, err: msg }, "네이버 블로그 RSS 실패");
      errors.push(`블로그 ${blog.name}(${blog.blogId}): ${msg.slice(0, 60)}`);
    }
  }

  return { stories: all, errors };
}
