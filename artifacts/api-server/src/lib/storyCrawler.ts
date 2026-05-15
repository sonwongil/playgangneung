import axios from "axios";
import https from "https";
import * as cheerio from "cheerio";
import crypto from "crypto";
import { logger } from "./logger.js";
import { readSources } from "./sources.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

// 강릉 관련 키워드 — 소스가 이미 강릉 전용이면 필터 완화
const GANGNEUNG_KEYWORDS = /강릉|경포|주문진|사천|옥계|성산|구정|연곡|왕산|강동|노암|포남|교동|남문|내곡|홍제|내곡|성내|임당|옥천|강릉시/;

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

    // <link> in RSS can be tricky — try multiple approaches
    let link = $el.find("link").first().text().trim();
    if (!link) link = $el.find("link").first().next().text().trim();
    if (!link) link = $el.find("guid").first().text().trim();

    const desc = $el
      .find("description")
      .first()
      .text()
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);

    const pubDate = $el.find("pubDate, dc\\:date, published").first().text().trim();

    if (!title || !link) return;

    // 강릉 키워드 필터 (엄격 모드일 때만)
    if (strictFilter) {
      const combined = title + " " + desc;
      if (!GANGNEUNG_KEYWORDS.test(combined)) return;
    }

    // 스팸/법적고지 필터
    const JUNK = /이메일.*자동수집|정보통신망법|저작권|무단전재|copyright|all rights reserved/i;
    if (JUNK.test(desc)) return;

    // 이미지 추출
    let image = $el.find("enclosure[type^='image']").attr("url") ?? "";
    if (!image) {
      const encoded = $el.find("content\\:encoded, encoded").first().text();
      const imgMatch = encoded.match(/src=["']([^"']+\.(jpg|jpeg|png|webp)[^"']*)/i);
      if (imgMatch) image = imgMatch[1];
    }

    const id = makeId("story", link);

    stories.push({
      id,
      title,
      body: desc,
      images: image ? [image] : [],
      sourceUrl: link,
      author: sourceName,
      tags: [
        ...defaultTags,
        pubDate ? new Date(pubDate).getFullYear().toString() : "",
      ].filter(Boolean),
    });
  });

  return stories;
}

// ─── 기본 RSS 소스 (실제 동작 확인된 것만) ───────────────────────────────────
const DEFAULT_STORY_SOURCES: { name: string; url: string; tags: string[]; strictFilter: boolean }[] = [
  {
    name: "강원도민일보 강릉",
    url: "https://cdn.kado.net/rss/gn_rss_allArticle.xml",
    tags: ["강릉", "지역소식"],
    strictFilter: true, // 강릉 키워드 필터 적용 (전체 기사 중 강릉 관련만)
  },
];

export async function crawlStories(): Promise<{ stories: CrawledStory[]; errors: string[] }> {
  const all: CrawledStory[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();

  // DB에서 사용자 등록 소스 중 RSS URL (.xml 또는 rss 포함) 추가 활용
  let dbSources: { name: string; url: string; tags: string[]; strictFilter: boolean }[] = [];
  try {
    const sources = await readSources();
    dbSources = sources
      .filter((s) => s.enabled && (s.url.includes(".xml") || /\/rss[/?]/.test(s.url)))
      .map((s) => ({
        name: s.name,
        url: s.url,
        tags: ["지역소식"],
        strictFilter: true,
      }));
  } catch (err) {
    logger.warn({ err }, "DB 소스 로드 실패, 기본 소스만 사용");
  }

  const allSources = [
    ...DEFAULT_STORY_SOURCES,
    ...dbSources.filter((ds) => !DEFAULT_STORY_SOURCES.some((def) => def.url === ds.url)),
  ];

  for (const src of allSources) {
    try {
      const xml = await fetchXml(src.url);
      const items = parseRss(xml, src.name, src.tags, src.strictFilter);
      for (const s of items) {
        if (!seenIds.has(s.id)) {
          seenIds.add(s.id);
          all.push(s);
        }
      }
      logger.info({ source: src.name, count: items.length }, "스토리 RSS 크롤링 완료");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ source: src.name, err: msg }, "스토리 RSS 크롤링 실패 (정상)");
      errors.push(`${src.name}: ${msg.slice(0, 80)}`);
    }
  }

  return { stories: all, errors };
}
