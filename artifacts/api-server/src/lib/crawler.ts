import axios from "axios";
import https from "https";
import * as cheerio from "cheerio";
import crypto from "crypto";
import type { CrawledEvent } from "./storage.js";
import { logger } from "./logger.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function makeId(source: string, title: string): string {
  return crypto.createHash("md5").update(`${source}:${title}`).digest("hex");
}

async function fetchHtml(url: string): Promise<string> {
  const resp = await axios.get(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
      "Accept-Encoding": "gzip, deflate",
    },
    httpsAgent,
    timeout: 15000,
    responseType: "arraybuffer",
    maxRedirects: 5,
  });

  const buf = Buffer.from(resp.data as ArrayBuffer);
  const rawHtml = buf.toString("latin1");

  const metaCharset = rawHtml.match(/charset=["']?(euc-kr|ks_c_5601-1987|euc_kr)/i);
  const contentType: string = (resp.headers["content-type"] as string) || "";
  const isEucKr =
    metaCharset !== null ||
    contentType.toLowerCase().includes("euc-kr") ||
    contentType.toLowerCase().includes("ks_c_5601");

  if (isEucKr) {
    const { default: iconv } = await import("iconv-lite");
    return iconv.decode(buf, "euc-kr");
  }

  return buf.toString("utf-8");
}

function extractEventsFromHtml(html: string, url: string, sourceName: string): CrawledEvent[] {
  const $ = cheerio.load(html);
  const events: CrawledEvent[] = [];
  const origin = (() => {
    try {
      return new URL(url).origin;
    } catch {
      return "";
    }
  })();

  const candidates = [
    "table tbody tr",
    ".board-list li",
    ".list-wrap li",
    ".bbs-list tr",
    ".notice-list tr",
    "ul.list li",
    ".festival-list li",
    ".event-list li",
    "article",
  ];

  for (const selector of candidates) {
    const items = $(selector);
    if (items.length === 0) continue;

    items.each((_, el) => {
      const $el = $(el);
      const $a = $el.find("a").first();
      const title = $a.text().trim() || $el.find("td").eq(1).text().trim();
      if (!title || title.length < 2) return;

      const href = $a.attr("href") || "";
      const link = href.startsWith("http")
        ? href
        : href
        ? `${origin}${href.startsWith("/") ? "" : "/"}${href}`
        : url;

      const allText = $el.text();
      const dateMatch = allText.match(/\d{4}[-./]\d{2}[-./]\d{2}/);
      const date = dateMatch ? dateMatch[0] : "";

      const desc = $el.find(".desc, .summary, p").first().text().trim();

      events.push({
        id: makeId(sourceName, title),
        title,
        description: desc,
        date,
        link,
        source: sourceName,
        crawledAt: new Date().toISOString(),
      });
    });

    if (events.length > 0) break;
  }

  return events;
}

interface CrawlSource {
  name: string;
  url: string;
}

const DEFAULT_SOURCES: CrawlSource[] = [
  {
    name: "강릉시청 - 공지사항",
    url: "https://www.gangneung.go.kr/open_content/index.do?menu_id=00100200",
  },
  {
    name: "강릉시청 - 행사정보",
    url: "https://www.gangneung.go.kr/open_content/index.do?menu_id=01030100",
  },
  {
    name: "강원특별자치도 - 행사/축제",
    url: "https://www.gw.go.kr/open/event/eventList.do",
  },
];

export interface CrawlResult {
  source: string;
  url: string;
  events: CrawledEvent[];
  error?: string;
}

export async function crawlUrl(url: string): Promise<CrawledEvent[]> {
  const origin = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();
  const html = await fetchHtml(url);
  return extractEventsFromHtml(html, url, origin);
}

export async function crawlAll(): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];

  for (const source of DEFAULT_SOURCES) {
    try {
      logger.info({ url: source.url }, `크롤링 시작: ${source.name}`);
      const html = await fetchHtml(source.url);
      const events = extractEventsFromHtml(html, source.url, source.name);
      logger.info({ count: events.length }, `크롤링 완료: ${source.name}`);
      results.push({ source: source.name, url: source.url, events });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ url: source.url, err: msg }, `크롤링 실패: ${source.name}`);
      results.push({ source: source.name, url: source.url, events: [], error: msg });
    }
  }

  return results;
}
