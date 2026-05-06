import axios from "axios";
import https from "https";
import * as cheerio from "cheerio";
import crypto from "crypto";
import type { CrawledEvent, SourceType } from "./storage.js";
import { parseDates, detectCategory } from "./dateParser.js";
import { logger } from "./logger.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function makeId(ns: string, val: string): string {
  return crypto.createHash("md5").update(`${ns}:${val}`).digest("hex");
}

async function fetchHtml(url: string, timeoutMs = 15000): Promise<string> {
  const resp = await axios.get(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9",
      "Accept-Encoding": "gzip, deflate",
      Referer: new URL(url).origin + "/",
    },
    httpsAgent,
    timeout: timeoutMs,
    responseType: "arraybuffer",
    maxRedirects: 5,
  });

  const buf = Buffer.from(resp.data as ArrayBuffer);
  const rawLatin = buf.toString("latin1");
  const isEucKr =
    /charset=["']?(euc-kr|ks_c_5601[-_]1987|euc_kr)/i.test(rawLatin) ||
    /euc-kr|ks_c_5601/i.test((resp.headers["content-type"] as string) ?? "");

  if (isEucKr) {
    const { default: iconv } = await import("iconv-lite");
    return iconv.decode(buf, "euc-kr");
  }
  return buf.toString("utf-8");
}

function buildEvent(
  id: string,
  title: string,
  desc: string,
  dateRaw: string,
  link: string,
  sourceName: string,
  sourceType: SourceType,
  thumbnail: string | null,
  locationHint?: string,
  defaultCategory?: string,
): CrawledEvent {
  const { startDate, endDate, scheduleStatus } = parseDates(dateRaw);
  const category = detectCategory(title, desc) || defaultCategory || "행사";
  return {
    id,
    title,
    description: desc,
    date: startDate || dateRaw,
    startDate,
    endDate,
    scheduleStatus,
    location: locationHint || "강릉",
    category,
    thumbnail,
    link,
    source: sourceName,
    sourceType,
    status: "draft",
    socialDraft: null,
    cardImageUrl: null,
    crawledAt: new Date().toISOString(),
  };
}

// ─── 강릉시 통합예약시스템 - 이달의 행사 ────────────────────────────────────

const GN_YEYAK_BASE = "https://www.gn.go.kr";

async function crawlGnYeyak(): Promise<{ events: CrawledEvent[]; error?: string }> {
  const url = `${GN_YEYAK_BASE}/yeyak/selectUnityEventWebList.do?key=6420`;
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const events: CrawledEvent[] = [];
    const seen = new Set<string>();

    $("li").each((_, el) => {
      const $el = $(el);
      const $btn = $el.find("button.category_link");
      if ($btn.length === 0) return;

      const title = $btn.find("em.text").text().trim();
      if (!title || title.length < 2) return;

      const categoryLabel = $btn.find("em.category").text().trim();

      const $popup = $el.find(".popup_inner");
      const infoText = $popup.find("ul li").map((_, li) => $(li).text().trim()).get();

      const dateRaw = infoText.find(t => t.startsWith("기간"))?.replace("기간 : ", "").trim() ?? "";
      const location = infoText.find(t => t.startsWith("장소"))?.replace("장소 : ", "").trim() || "강릉";

      const $detailLink = $popup.find("a.more_link");
      const href = $detailLink.attr("href") || "";
      const link = href.startsWith("http") ? href : href ? `${GN_YEYAK_BASE}/yeyak/${href.replace(/^\.\//, "")}` : url;

      const imgStyle = $el.find(".img_wrap").attr("style") || "";
      const imgMatch = imgStyle.match(/url\(([^)]+)\)/);
      const thumbnail = imgMatch
        ? (imgMatch[1].startsWith("http") ? imgMatch[1] : `${GN_YEYAK_BASE}${imgMatch[1]}`)
        : null;

      const key = title + dateRaw;
      if (seen.has(key)) return;
      seen.add(key);

      const defaultCategory = categoryLabel === "공연" ? "행사"
        : categoryLabel === "축제" ? "행사"
        : categoryLabel === "전시" ? "행사"
        : "행사";

      events.push(buildEvent(
        makeId("gn_yeyak", link || title),
        title,
        location,
        dateRaw,
        link,
        "강릉시 이달의 행사",
        "html",
        thumbnail,
        location,
        defaultCategory,
      ));
    });

    return { events };
  } catch (err) {
    return { events: [], error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── 강릉아트센터 공연일정 ────────────────────────────────────────────────────

const GN_ARTSCENTER_BASE = "https://www.gn.go.kr";

async function crawlGnArtscenter(): Promise<{ events: CrawledEvent[]; error?: string }> {
  const url = `${GN_ARTSCENTER_BASE}/artscenter/selectMoonhwainList.do?key=5728&searchMoon_p_team=artCenter`;
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const events: CrawledEvent[] = [];

    $("ul.performance_list li.performance_item").each((_, el) => {
      const $el = $(el);
      const $a = $el.find("a").first();
      const href = $a.attr("href") || "";
      const link = href.startsWith("http")
        ? href
        : href
        ? `${GN_ARTSCENTER_BASE}/artscenter/${href.replace(/^\.\//, "")}`
        : url;

      const title = $el.find("span.performance_title").text().trim();
      if (!title || title.length < 2) return;

      // 날짜: 첫 번째 performance_date (기간), 두 번째는 시간 정보
      const $dates = $el.find("span.performance_date");
      const dateRaw = $dates.first().text().trim();

      const location = $el.find("span.performance_place").text().trim() || "강릉아트센터";

      // 썸네일: background:url('...') 또는 img src
      const imgStyle = $el.find("span.image").attr("style") || "";
      const imgMatch = imgStyle.match(/url\(['"]?([^'")\s]+)['"]?\)/);
      const thumbnail = imgMatch
        ? (imgMatch[1].startsWith("http") ? imgMatch[1] : `${GN_ARTSCENTER_BASE}${imgMatch[1]}`)
        : null;

      events.push(buildEvent(
        makeId("gn_artscenter", link || title),
        title,
        location,
        dateRaw,
        link,
        "강릉아트센터",
        "html",
        thumbnail,
        location,
        "행사",
      ));
    });

    return { events };
  } catch (err) {
    return { events: [], error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── 강릉문화예술재단 ────────────────────────────────────────────────────────

const GNCAF_BASE = "https://www.gncaf.or.kr";

async function crawlGncaf(): Promise<{ events: CrawledEvent[]; error?: string }> {
  const url = `${GNCAF_BASE}/ko/community/event`;
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const events: CrawledEvent[] = [];

    $("div.grid-item").each((_, el) => {
      const $el = $(el);
      const $a = $el.find("a.card-hover-2");
      if ($a.length === 0) return;

      const href = $a.attr("href") || "";
      const link = href.startsWith("http") ? href : `${GNCAF_BASE}${href}`;

      const title = $a.find("h5.tags").text().trim();
      if (!title || title.length < 2) return;

      const metaText = $a.find("p.tags").text().trim();
      const parts = metaText.split("/");
      const location = parts[0]?.trim() || "강릉";
      const dateRaw = parts[1]?.trim() || "";

      const imgSrc = $a.find("img.img-zoom").attr("src") || "";
      const thumbnail = imgSrc
        ? (imgSrc.startsWith("http") ? imgSrc : `${GNCAF_BASE}${imgSrc}`)
        : null;

      events.push(buildEvent(
        makeId("gncaf", link || title),
        title,
        location,
        dateRaw,
        link,
        "강릉문화예술재단",
        "html",
        thumbnail,
        location,
        "행사",
      ));
    });

    return { events };
  } catch (err) {
    return { events: [], error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── crawlUrl (수동 URL 크롤링) ───────────────────────────────────────────────

export async function crawlUrl(url: string): Promise<CrawledEvent[]> {
  const hostname = (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })();

  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const events: CrawledEvent[] = [];

    const DEFAULT_SELECTORS = [
      "table tbody tr",
      ".board-list li",
      ".list-wrap li",
      "ul.list li",
      "article",
    ];

    const origin = (() => {
      try { return new URL(url).origin; } catch { return ""; }
    })();

    for (const selector of DEFAULT_SELECTORS) {
      if ($(selector).length === 0) continue;
      $(selector).each((_, el) => {
        const $el = $(el);
        const $a = $el.find("a").first();
        const title = ($a.text().trim() || $el.find("td").eq(1).text().trim()).slice(0, 200);
        if (!title || title.length < 2) return;
        const href = $a.attr("href") || "";
        const link = href.startsWith("http") ? href : href ? `${origin}${href.startsWith("/") ? "" : "/"}${href}` : url;
        const dateRaw = $el.text().match(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/)?.[0] ?? "";
        events.push(buildEvent(
          makeId(hostname, link || title),
          title,
          "",
          dateRaw,
          link,
          hostname,
          "html",
          null,
          "강릉",
          "지역소식",
        ));
      });
      if (events.length > 0) break;
    }
    return events;
  } catch {
    return [];
  }
}

// ─── Main: crawlAll ───────────────────────────────────────────────────────────

export interface CrawlResult {
  source: string;
  url: string;
  sourceType: SourceType;
  events: CrawledEvent[];
  error?: string;
}

export async function crawlAll(): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];

  // 강릉시 이달의 행사
  logger.info({ url: "https://www.gn.go.kr/yeyak/selectUnityEventWebList.do?key=6420" }, "[HTML] 크롤링 시작: 강릉시 이달의 행사");
  const gnResult = await crawlGnYeyak();
  logger.info({ count: gnResult.events.length, error: gnResult.error }, "[HTML] 완료: 강릉시 이달의 행사");
  results.push({
    source: "강릉시 이달의 행사",
    url: `${GN_YEYAK_BASE}/yeyak/selectUnityEventWebList.do?key=6420`,
    sourceType: "html",
    ...gnResult,
  });

  // 강릉아트센터 공연일정
  logger.info({ url: `${GN_ARTSCENTER_BASE}/artscenter/selectMoonhwainList.do?key=5728&searchMoon_p_team=artCenter` }, "[HTML] 크롤링 시작: 강릉아트센터");
  const artsResult = await crawlGnArtscenter();
  logger.info({ count: artsResult.events.length, error: artsResult.error }, "[HTML] 완료: 강릉아트센터");
  results.push({
    source: "강릉아트센터",
    url: `${GN_ARTSCENTER_BASE}/artscenter/selectMoonhwainList.do?key=5728&searchMoon_p_team=artCenter`,
    sourceType: "html",
    ...artsResult,
  });

  // 강릉문화예술재단
  logger.info({ url: "https://www.gncaf.or.kr/ko/community/event" }, "[HTML] 크롤링 시작: 강릉문화예술재단");
  const gncafResult = await crawlGncaf();
  logger.info({ count: gncafResult.events.length, error: gncafResult.error }, "[HTML] 완료: 강릉문화예술재단");
  results.push({
    source: "강릉문화예술재단",
    url: `${GNCAF_BASE}/ko/community/event`,
    sourceType: "html",
    ...gncafResult,
  });

  return results;
}
