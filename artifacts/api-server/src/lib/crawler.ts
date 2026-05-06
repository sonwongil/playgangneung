import axios from "axios";
import https from "https";
import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import crypto from "crypto";
import type { CrawledEvent, SourceType } from "./storage.js";
import { parseDates, detectCategory } from "./dateParser.js";
import { logger } from "./logger.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
});

function makeId(ns: string, val: string): string {
  return crypto.createHash("md5").update(`${ns}:${val}`).digest("hex");
}

// ─── HTTP fetch ───────────────────────────────────────────────────────────────

interface FetchResult {
  body: Buffer;
  contentType: string;
  statusCode: number;
}

async function fetchRaw(url: string, timeoutMs = 12000): Promise<FetchResult> {
  const resp = await axios.get(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*",
      "Accept-Language": "ko-KR,ko;q=0.9",
      "Accept-Encoding": "gzip, deflate",
    },
    httpsAgent,
    timeout: timeoutMs,
    responseType: "arraybuffer",
    maxRedirects: 5,
  });

  return {
    body: Buffer.from(resp.data as ArrayBuffer),
    contentType: (resp.headers["content-type"] as string) ?? "",
    statusCode: resp.status,
  };
}

async function decodeBuffer(buf: Buffer, contentType: string): Promise<string> {
  const rawLatin = buf.toString("latin1");
  const isEucKr =
    /charset=["']?(euc-kr|ks_c_5601[-_]1987|euc_kr)/i.test(rawLatin) ||
    /euc-kr|ks_c_5601/i.test(contentType);

  if (isEucKr) {
    const { default: iconv } = await import("iconv-lite");
    return iconv.decode(buf, "euc-kr");
  }
  return buf.toString("utf-8");
}

function isRssContentType(ct: string): boolean {
  return /rss|atom|xml/i.test(ct);
}

// ─── Tier 1: RSS / Atom ───────────────────────────────────────────────────────

interface RssSource {
  name: string;
  url: string;
  defaultCategory?: string;
}

// 강릉 전용 RSS 소스
const RSS_SOURCES: RssSource[] = [
  {
    name: "강릉시청 - 공지사항",
    url: "https://www.gangneung.go.kr/rss.do?menu_id=00100200",
    defaultCategory: "지역소식",
  },
  {
    name: "강릉시청 - 행사정보",
    url: "https://www.gangneung.go.kr/rss.do?menu_id=01030100",
    defaultCategory: "행사",
  },
  {
    name: "강릉문화재단",
    url: "https://www.gcf.or.kr/rss.do",
    defaultCategory: "행사",
  },
];

function buildEvent(
  id: string,
  title: string,
  desc: string,
  dateRaw: string,
  link: string,
  sourceName: string,
  sourceType: SourceType,
  defaultCategory?: string,
): CrawledEvent {
  const { startDate, endDate, scheduleStatus } = parseDates(dateRaw);
  const category = detectCategory(title, desc) || defaultCategory || "지역소식";
  return {
    id,
    title,
    description: desc,
    date: startDate || dateRaw,
    startDate,
    endDate,
    scheduleStatus,
    location: "강릉",
    category,
    thumbnail: null,
    link,
    source: sourceName,
    sourceType,
    status: "draft",
    socialDraft: null,
    cardImageUrl: null,
    crawledAt: new Date().toISOString(),
  };
}

function parseRssXml(xml: string, sourceName: string, defaultCategory?: string): CrawledEvent[] {
  const events: CrawledEvent[] = [];
  let parsed: Record<string, unknown>;

  try {
    parsed = xmlParser.parse(xml) as Record<string, unknown>;
  } catch {
    return events;
  }

  // RSS 2.0
  const rssRoot = parsed["rss"] as Record<string, unknown> | undefined;
  const channel = rssRoot?.["channel"] as Record<string, unknown> | undefined;
  const rawItems = channel?.["item"] as unknown[] | undefined;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  // Atom
  const feedRoot = parsed["feed"] as Record<string, unknown> | undefined;
  const atomEntries = feedRoot?.["entry"] as unknown[] | undefined;
  const entries = Array.isArray(atomEntries)
    ? atomEntries
    : atomEntries
    ? [atomEntries]
    : [];

  const allItems = [...items, ...entries];

  for (const item of allItems) {
    const it = item as Record<string, unknown>;
    const title = String(
      (it["title"] as Record<string, unknown>)?.["#text"] ?? it["title"] ?? "",
    ).trim();
    if (!title || title.length < 2) continue;

    const linkVal = it["link"];
    const link = String(
      typeof linkVal === "object" && linkVal !== null
        ? (linkVal as Record<string, unknown>)["@_href"] ?? ""
        : linkVal ?? "",
    ).trim();

    const pubDate = String(
      it["pubDate"] ?? it["published"] ?? it["updated"] ?? "",
    ).trim();

    const desc = String(
      it["description"] ??
        (it["content"] as Record<string, unknown>)?.["#text"] ??
        it["summary"] ??
        "",
    )
      .replace(/<[^>]+>/g, "")
      .trim()
      .slice(0, 200);

    events.push(
      buildEvent(
        makeId(sourceName, link || title),
        title,
        desc,
        pubDate,
        link,
        sourceName,
        "rss",
        defaultCategory,
      ),
    );
  }

  return events;
}

export async function crawlRss(
  url: string,
  sourceName: string,
  defaultCategory?: string,
): Promise<{ events: CrawledEvent[]; error?: string }> {
  try {
    const { body, contentType } = await fetchRaw(url);
    const text = await decodeBuffer(body, contentType);
    const events = parseRssXml(text, sourceName, defaultCategory);
    return { events };
  } catch (err) {
    return { events: [], error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Tier 2: HTML crawling ────────────────────────────────────────────────────

interface HtmlSource {
  name: string;
  url: string;
  selectors?: string[];
  defaultCategory?: string;
}

// 강릉 전용 HTML 소스
const HTML_SOURCES: HtmlSource[] = [
  {
    name: "강릉시청 - 문화관광 행사",
    url: "https://www.gangneung.go.kr/open_content/index.do?menu_id=01030100",
    defaultCategory: "행사",
  },
  {
    name: "강릉문화재단 - 공연전시",
    url: "https://www.gcf.or.kr/program/list.do",
    defaultCategory: "행사",
  },
];

const DEFAULT_SELECTORS = [
  "table tbody tr",
  ".board-list li",
  ".list-wrap li",
  ".bbs-list tr",
  ".notice-list tr",
  "ul.list li",
  ".festival-list li",
  ".event-list li",
  ".program-list li",
  "article",
];

function parseHtml(
  html: string,
  url: string,
  sourceName: string,
  selectors: string[] = DEFAULT_SELECTORS,
  defaultCategory?: string,
): CrawledEvent[] {
  const $ = cheerio.load(html);
  const events: CrawledEvent[] = [];
  const origin = (() => {
    try { return new URL(url).origin; } catch { return ""; }
  })();

  for (const selector of selectors) {
    if ($(selector).length === 0) continue;

    $(selector).each((_, el) => {
      const $el = $(el);
      const $a = $el.find("a").first();
      const title = ($a.text().trim() || $el.find("td").eq(1).text().trim()).slice(0, 200);
      if (!title || title.length < 2) return;

      const href = $a.attr("href") || "";
      const link = href.startsWith("http")
        ? href
        : href
        ? `${origin}${href.startsWith("/") ? "" : "/"}${href}`
        : url;

      const dateRaw = $el.text().match(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/)?.[0] ?? "";
      const desc = $el.find(".desc, .summary, p").first().text().trim().slice(0, 200);

      events.push(
        buildEvent(
          makeId(sourceName, link || title),
          title,
          desc,
          dateRaw,
          link,
          sourceName,
          "html",
          defaultCategory,
        ),
      );
    });

    if (events.length > 0) break;
  }

  return events;
}

export async function crawlHtml(
  url: string,
  sourceName: string,
  selectors?: string[],
  defaultCategory?: string,
): Promise<{ events: CrawledEvent[]; error?: string }> {
  try {
    const { body, contentType } = await fetchRaw(url);
    const text = await decodeBuffer(body, contentType);
    const events = parseHtml(text, url, sourceName, selectors, defaultCategory);
    return { events };
  } catch (err) {
    return { events: [], error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Auto-detect: RSS vs HTML ─────────────────────────────────────────────────

export async function crawlUrl(url: string): Promise<CrawledEvent[]> {
  const hostname = (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })();

  try {
    const { body, contentType } = await fetchRaw(url);
    const text = await decodeBuffer(body, contentType);

    if (
      isRssContentType(contentType) ||
      /^<\?xml|<rss|<feed/i.test(text.trim())
    ) {
      const events = parseRssXml(text, hostname);
      if (events.length > 0) return events;
    }

    return parseHtml(text, url, hostname);
  } catch {
    return [];
  }
}

// ─── Main: crawlAll (강릉 전용) ───────────────────────────────────────────────

export interface CrawlResult {
  source: string;
  url: string;
  sourceType: SourceType;
  events: CrawledEvent[];
  error?: string;
}

export async function crawlAll(): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];

  // Tier 1: RSS (강릉 전용)
  for (const src of RSS_SOURCES) {
    logger.info({ url: src.url }, `[RSS] 크롤링 시작: ${src.name}`);
    const { events, error } = await crawlRss(src.url, src.name, src.defaultCategory);
    logger.info({ count: events.length, error }, `[RSS] 완료: ${src.name}`);
    results.push({ source: src.name, url: src.url, sourceType: "rss", events, error });
  }

  // Tier 2: HTML (강릉 전용)
  for (const src of HTML_SOURCES) {
    logger.info({ url: src.url }, `[HTML] 크롤링 시작: ${src.name}`);
    const { events, error } = await crawlHtml(src.url, src.name, src.selectors, src.defaultCategory);
    logger.info({ count: events.length, error }, `[HTML] 완료: ${src.name}`);
    results.push({ source: src.name, url: src.url, sourceType: "html", events, error });
  }

  return results;
}
