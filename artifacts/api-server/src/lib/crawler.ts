import axios from "axios";
import https from "https";
import * as cheerio from "cheerio";
import crypto from "crypto";
import type { CrawledEvent, SourceType } from "./storage.js";
import { parseDates, detectCategory } from "./dateParser.js";
import { logger } from "./logger.js";
import { readSources } from "./sources.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function makeId(ns: string, val: string): string {
  return crypto.createHash("md5").update(`${ns}:${val}`).digest("hex");
}

async function fetchHtml(url: string, timeoutMs = 15000, referer?: string): Promise<string> {
  const resp = await axios.get(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9",
      "Accept-Encoding": "gzip, deflate",
      Referer: referer ?? (new URL(url).origin + "/"),
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

// ─── 상세페이지 설명 추출 헬퍼 ───────────────────────────────────────────────

const PHONE_RE = /0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/;

/**
 * 상세페이지 URL에서 본문 설명, 문의처 전화번호, 썸네일을 추출합니다.
 * referer: 목록 페이지 URL (gn.go.kr 계열은 Referer 없으면 500)
 */
async function fetchDetailInfo(
  url: string,
  timeoutMs = 8000,
  referer?: string,
): Promise<{ desc: string; contact: string; thumbnail?: string }> {
  try {
    const html = await fetchHtml(url, timeoutMs, referer);
    const $ = cheerio.load(html);

    // ── 문의처 추출 ────────────────────────────────────────────────────────
    let contact = "";

    $("table tr, dl, .info-list li, .detail_info li").each((_, el) => {
      const $el = $(el);
      const label = $el.find("th, dt, .label, strong, .tit").first().text().trim();
      if (/문의|연락|전화|tel/i.test(label)) {
        const val = $el.find("td, dd, .value, .txt").first().text().trim();
        const phone = val.match(PHONE_RE)?.[0] ?? val;
        if (phone) { contact = phone; return false; }
      }
    });

    // fallback: 페이지 전체에서 전화번호 패턴 탐색
    if (!contact) {
      const bodyText = $("body").text();
      const match = bodyText.match(PHONE_RE);
      if (match) contact = match[0];
    }

    // ── 설명 추출 ──────────────────────────────────────────────────────────
    const CONTENT_SELECTORS = [
      // gn.go.kr 통합예약/아트센터 전용
      ".view_text",
      ".view_box",
      // 강릉문화예술재단
      ".fcontent",
      ".view_cont",
      ".board-view-content",
      ".board_view .cont",
      ".board_view .content",
      ".view-content",
      ".view_content",
      ".cont_area",
      ".detail_content",
      ".post-content",
      ".entry-content",
      ".content_body",
      "article .content",
      "#content .content",
      ".main-content",
    ];

    let desc = "";
    for (const sel of CONTENT_SELECTORS) {
      const el = $(sel);
      if (el.length === 0) continue;
      el.find("script,style,iframe,nav,header,footer,.skip,.view_img_list,.view_title,.view_back,a.view_back,span.view_title").remove();
      const text = el.text().replace(/\s+/g, " ").trim();
      if (text.length > 20) { desc = text.slice(0, 500); break; }
    }

    if (!desc) {
      const ogDesc = $("meta[property='og:description']").attr("content") || "";
      if (ogDesc.length > 10) desc = ogDesc.slice(0, 500);
    }
    if (!desc) {
      const metaDesc = $("meta[name='description']").attr("content") || "";
      if (metaDesc.length > 10) desc = metaDesc.slice(0, 500);
    }

    // 불량 설명 필터 (법적고지, 저작권 안내 등 정부사이트 공통 상투문)
    const JUNK_PATTERNS = [
      /이메일\s*주소가\s*자동\s*수집/,
      /정보통신망법에\s*의해\s*처벌/,
      /저작권\s*보호를\s*받는\s*저작물/,
      /무단\s*전재.*재배포\s*금지/,
      /copyright/i,
      /all rights reserved/i,
    ];
    if (JUNK_PATTERNS.some((p) => p.test(desc))) desc = "";

    // ── 썸네일 추출 (gn.go.kr /DATA/event/main/...) ──────────────────────
    let thumbnail: string | undefined;
    const origin = (() => { try { return new URL(url).origin; } catch { return ""; } })();
    const mainImg = $(".detail_img_box img, .img_inner img").first().attr("src") || "";
    if (mainImg) {
      thumbnail = mainImg.startsWith("http") ? mainImg : `${origin}${mainImg}`;
    }

    return { desc, contact, thumbnail };
  } catch {
    return { desc: "", contact: "" };
  }
}

/** 병렬 상세 fetch (최대 concurrency 제한) */
async function fetchDetailInfos(
  items: { id: string; link: string }[],
  concurrency = 4,
  referer?: string,
): Promise<Record<string, { desc: string; contact: string; thumbnail?: string }>> {
  const result: Record<string, { desc: string; contact: string; thumbnail?: string }> = {};
  const queue = [...items];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      if (!item.link || item.link.length < 10) continue;
      result[item.id] = await fetchDetailInfo(item.link, 8000, referer);
    }
  }

  await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return result;
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
  contact?: string,
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
    contact: contact || "",
    sourceType,
    status: "approved",
    socialDraft: null,
    crawledAt: new Date().toISOString(),
  };
}

// ─── 강릉시 통합예약시스템 - 이달의 행사 ────────────────────────────────────

const GN_YEYAK_BASE = "https://www.gn.go.kr";

/** 단일 달 페이지에서 rawItems 추출 */
function parseGnYeyakPage(
  html: string,
  pageUrl: string,
  seen: Set<string>,
): {
  id: string; title: string; dateRaw: string; link: string;
  location: string; thumbnail: string | null; inlineDesc: string; defaultCategory: string;
}[] {
  const $ = cheerio.load(html);
  const items: {
    id: string; title: string; dateRaw: string; link: string;
    location: string; thumbnail: string | null; inlineDesc: string; defaultCategory: string;
  }[] = [];

  $("li").each((_, el) => {
    const $el = $(el);
    const $btn = $el.find("button.category_link");
    if ($btn.length === 0) return;

    const title = $btn.find("em.text").text().trim();
    if (!title || title.length < 2) return;

    const categoryLabel = $btn.find("em.category").text().trim();

    const $popup = $el.find(".popup_inner");
    const infoItems = $popup.find("ul li").map((_, li) => $(li).text().trim()).get();

    const dateRaw = infoItems.find(t => t.startsWith("기간"))?.replace(/^기간\s*:\s*/, "").trim() ?? "";
    const location = infoItems.find(t => t.startsWith("장소"))?.replace(/^장소\s*:\s*/, "").trim() || "강릉";

    const extraInfo = infoItems
      .filter(t => !t.startsWith("기간") && !t.startsWith("장소") && t.length > 1)
      .join(" | ");

    const $detailLink = $popup.find("a.more_link");
    const href = $detailLink.attr("href") || "";
    const link = href.startsWith("http") ? href : href ? `${GN_YEYAK_BASE}/yeyak/${href.replace(/^\.\//, "")}` : pageUrl;

    const imgStyle = $el.find(".img_wrap").attr("style") || "";
    const imgMatch = imgStyle.match(/url\(([^)'"]+)[)'"]/);
    const thumbnail = imgMatch
      ? (imgMatch[1].startsWith("http") ? imgMatch[1] : `${GN_YEYAK_BASE}${imgMatch[1]}`)
      : null;

    // 행사 ID는 상세 링크 기준 (중복 제거)
    const id = makeId("gn_yeyak", link || title);
    if (seen.has(id)) return;
    seen.add(id);

    const defaultCategory = ["공연", "축제", "전시"].includes(categoryLabel) ? "행사" : "행사";
    items.push({ id, title, dateRaw, link, location, thumbnail, inlineDesc: extraInfo, defaultCategory });
  });

  return items;
}

async function crawlGnYeyak(
  listUrl = `${GN_YEYAK_BASE}/yeyak/selectUnityEventWebList.do?key=6420`,
  sourceName = "강릉시 이달의 행사",
): Promise<{ events: CrawledEvent[]; error?: string }> {
  const BASE_URL = listUrl;
  try {
    // 현재 달 + 다음 2개월 크롤링
    const today = new Date();
    const months: { year: number; month: number }[] = [];
    for (let offset = 0; offset <= 2; offset++) {
      const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    const seen = new Set<string>();
    const rawItems: ReturnType<typeof parseGnYeyakPage> = [];

    for (const { year, month } of months) {
      const pageUrl = `${BASE_URL}&searchYear=${year}&searchMonth=${month}&searchEventCd=`;
      try {
        const html = await fetchHtml(pageUrl, 15000, BASE_URL);
        const items = parseGnYeyakPage(html, pageUrl, seen);
        rawItems.push(...items);
        logger.info({ year, month, count: items.length }, "[gn_yeyak] 달 크롤링 완료");
      } catch (err) {
        logger.warn({ year, month, err }, "[gn_yeyak] 달 크롤링 실패, 건너뜀");
      }
    }

    // 상세페이지 병렬 fetch (Referer: 목록 페이지)
    const detailLinks = rawItems
      .filter(it => it.link && it.link !== BASE_URL)
      .map(it => ({ id: it.id, link: it.link }));
    const infoMap = await fetchDetailInfos(detailLinks, 4, BASE_URL);

    const events: CrawledEvent[] = rawItems.map(it => {
      const info = infoMap[it.id];
      const desc = info?.desc || it.inlineDesc || it.location;
      const thumbnail = it.thumbnail || info?.thumbnail || null;
      return buildEvent(
        it.id,
        it.title,
        desc,
        it.dateRaw,
        it.link,
        sourceName,
        "html",
        thumbnail,
        it.location,
        it.defaultCategory,
        info?.contact,
      );
    });

    return { events };
  } catch (err) {
    return { events: [], error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── 강릉시 교육/강좌·체험/견학 (li.edu_item 구조) ────────────────────────────

/**
 * selectUnityProgrmWebList.do (교육/강좌) 및
 * selectUnityExprnWebList.do (체험/견학) 페이지 파서.
 * HTML 구조: <li class="edu_item"> ... </li>
 * 날짜: <span class="edu_dt">운영</span><span class="edu_dd">YYYY-MM-DD ~ YYYY-MM-DD</span>
 */
function parseGnYeyakEduList(
  html: string,
  pageUrl: string,
): Array<{
  id: string;
  title: string;
  dateRaw: string;
  link: string;
  location: string;
  thumbnail: string | null;
  type: string;
}> {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl).origin + "/yeyak/";
  const items: ReturnType<typeof parseGnYeyakEduList> = [];

  $("li.edu_item").each((_, el) => {
    const $el = $(el);
    const href = $el.find("a").first().attr("href") || "";
    const link = href.startsWith("http") ? href : href ? base + href.replace(/^\.\//, "") : pageUrl;

    const title = $el.find("span.edu_title").text().trim();
    if (!title || title.length < 2) return;

    // 운영기간 우선, 없으면 접수기간 사용
    let dateRaw = "";
    $el.find("li").each((_, li) => {
      const dt = $(li).find("span.edu_dt").text().trim();
      const dd = $(li).find("span.edu_dd").text().trim().replace(/\s+/g, " ");
      if (dt === "운영" && !dateRaw) dateRaw = dd;
    });
    if (!dateRaw) {
      $el.find("li").each((_, li) => {
        const dt = $(li).find("span.edu_dt").text().trim();
        const dd = $(li).find("span.edu_dd").text().trim().replace(/\s+/g, " ");
        if (dt === "접수" && !dateRaw) dateRaw = dd;
      });
    }

    let location = "";
    $el.find("li").each((_, li) => {
      const dt = $(li).find("span.edu_dt").text().trim();
      if (dt === "장소") location = $(li).find("span.edu_dd").text().trim();
    });

    const type = $el.find("span.edu_type").text().trim();

    const imgSrc = $el.find("img").first().attr("src") || "";
    const thumbnail = imgSrc
      ? imgSrc.startsWith("http")
        ? imgSrc
        : `https://www.gn.go.kr${imgSrc}`
      : null;

    const id = makeId("gn_edu", link || title);
    items.push({ id, title, dateRaw, link, location, thumbnail, type });
  });

  return items;
}

async function crawlGnYeyakEduList(
  listUrl: string,
  sourceName: string,
): Promise<{ events: CrawledEvent[]; error?: string }> {
  try {
    const html = await fetchHtml(listUrl, 20000, listUrl);
    const rawItems = parseGnYeyakEduList(html, listUrl);
    logger.info({ count: rawItems.length }, `[gn_edu] 목록 파싱 완료: ${sourceName}`);

    const detailLinks = rawItems
      .filter(it => it.link && it.link !== listUrl)
      .map(it => ({ id: it.id, link: it.link }));
    const infoMap = await fetchDetailInfos(detailLinks, 4, listUrl);

    const events: CrawledEvent[] = rawItems.map(it => {
      const info = infoMap[it.id];
      const desc = info?.desc || [it.type, it.location].filter(Boolean).join(" | ");
      const thumbnail = it.thumbnail || info?.thumbnail || null;
      return buildEvent(
        it.id,
        it.title,
        desc,
        it.dateRaw,
        it.link,
        sourceName,
        "html",
        thumbnail,
        it.location,
        "event",
        info?.contact,
      );
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

    const rawItems: {
      id: string;
      title: string;
      dateRaw: string;
      link: string;
      location: string;
      thumbnail: string | null;
      inlineDesc: string;
    }[] = [];

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

      const $dates = $el.find("span.performance_date");
      const dateRaw = $dates.first().text().trim();

      // 두 번째 performance_date span: 공연 시간/상세 일정 정보
      const scheduleInfo = $dates.eq(1).text().trim();

      const location = $el.find("span.performance_place").text().trim() || "강릉아트센터";

      // 예매상태, 공연등급 등 추가 정보
      const statusText = $el.find("span.performance_status, span.performance_grade, em.performance_status").text().trim();
      const extraText = $el.find("span.performance_cont, p.performance_desc, .performance_info").text().trim();

      // 설명 조합: 시간정보 + 장소 + 추가정보
      const inlineDesc = [scheduleInfo, location, statusText, extraText]
        .filter(Boolean)
        .join(" | ");

      const imgStyle = $el.find("span.image").attr("style") || "";
      const imgMatch = imgStyle.match(/url\(['"]?([^'")\s]+)['"]?\)/);
      const thumbnail = imgMatch
        ? (imgMatch[1].startsWith("http") ? imgMatch[1] : `${GN_ARTSCENTER_BASE}${imgMatch[1]}`)
        : null;

      const id = makeId("gn_artscenter", link || title);
      rawItems.push({ id, title, dateRaw, link, location, thumbnail, inlineDesc });
    });

    // 상세페이지 병렬 fetch (artscenter도 상세 정보 보강, Referer: 목록 페이지)
    const detailLinks = rawItems
      .filter(it => it.link && it.link !== url)
      .map(it => ({ id: it.id, link: it.link }));
    const infoMap = await fetchDetailInfos(detailLinks, 4, url);

    const events: CrawledEvent[] = rawItems.map(it => {
      const info = infoMap[it.id];
      const desc = info?.desc || it.inlineDesc || it.location;
      const thumbnail = it.thumbnail || info?.thumbnail || null;
      return buildEvent(
        it.id,
        it.title,
        desc,
        it.dateRaw,
        it.link,
        "강릉아트센터",
        "html",
        thumbnail,
        it.location,
        "행사",
        info?.contact,
      );
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

    const rawItems: {
      id: string;
      title: string;
      dateRaw: string;
      link: string;
      location: string;
      thumbnail: string | null;
    }[] = [];

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

      const id = makeId("gncaf", link || title);
      rawItems.push({ id, title, dateRaw, link, location, thumbnail });
    });

    // 강릉문화예술재단은 목록에 설명 없음 → 상세페이지 병렬 fetch 필수 (Referer: 목록 페이지)
    const detailLinks = rawItems
      .filter(it => it.link && it.link !== url)
      .map(it => ({ id: it.id, link: it.link }));
    const infoMap = await fetchDetailInfos(detailLinks, 4, url);

    const events: CrawledEvent[] = rawItems.map(it => {
      const info = infoMap[it.id];
      const desc = info?.desc || it.location;
      const thumbnail = it.thumbnail || info?.thumbnail || null;
      return buildEvent(
        it.id,
        it.title,
        desc,
        it.dateRaw,
        it.link,
        "강릉문화예술재단",
        "html",
        thumbnail,
        it.location,
        "행사",
        info?.contact,
      );
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

/** URL 패턴으로 전용 파서를 선택하고, 알 수 없는 URL은 범용 crawlUrl 사용 */
async function dispatchCrawl(
  url: string,
  name: string,
): Promise<{ events: CrawledEvent[]; error?: string }> {
  try {
    // gn.go.kr/yeyak — edu_item 리스트 구조 (교육/강좌, 체험/견학)
    if (
      url.includes("selectUnityProgrmWebList.do") ||
      url.includes("selectUnityExprnWebList.do")
    ) {
      return await crawlGnYeyakEduList(url, name);
    }
    // gn.go.kr/yeyak 캘린더 계열 (selectUnityEventWebList.do 등)
    if (url.includes("gn.go.kr/yeyak")) {
      return await crawlGnYeyak(url, name);
    }
    // 아트센터 계열 (artscenter 경로 또는 moonhwain.net)
    if (url.includes("gn.go.kr/artscenter") || url.includes("gn.moonhwain.net")) {
      return await crawlGnArtscenter();
    }
    if (url.includes("gncaf.or.kr")) {
      return await crawlGncaf();
    }
    // 범용 파서: 임의의 게시판/목록 페이지
    const events = await crawlUrl(url);
    return { events };
  } catch (err) {
    return { events: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function crawlAll(): Promise<CrawlResult[]> {
  const sources = await readSources();
  const enabled = sources.filter((s) => s.enabled);

  if (enabled.length === 0) {
    logger.warn("크롤링 소스가 없습니다. 소스를 추가해 주세요.");
    return [];
  }

  const results: CrawlResult[] = [];

  for (const source of enabled) {
    logger.info({ url: source.url }, `[HTML] 크롤링 시작: ${source.name}`);
    const result = await dispatchCrawl(source.url, source.name);
    logger.info({ count: result.events.length, error: result.error }, `[HTML] 완료: ${source.name}`);
    results.push({
      source: source.name,
      url: source.url,
      sourceType: "html",
      ...result,
    });
  }

  return results;
}
