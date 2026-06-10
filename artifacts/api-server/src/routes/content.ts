import { Router } from "express";
import { db, eventsTable, adsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { readEvents, type SocialDraft } from "../lib/storage.js";
import fs from "fs/promises";
import path from "path";

const router = Router();

const SITE_URL = process.env["SITE_URL"] ?? "https://playgangneung.com";

const PROXY_HOSTS = ["www.gn.go.kr", "gn.go.kr", "gn.moonhwain.net", "www.gncaf.or.kr", "gncaf.or.kr"];

function proxyUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    if (PROXY_HOSTS.includes(hostname)) return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  } catch { /* noop */ }
  return url;
}

function proxyUrlAbsolute(url: string): string {
  try {
    const { hostname } = new URL(url);
    if (PROXY_HOSTS.includes(hostname)) return `${SITE_URL}/api/proxy/image?url=${encodeURIComponent(url)}`;
  } catch { /* noop */ }
  return url;
}

const THUMBNAIL_MAP: Record<string, string> = {
  행사: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80",
  맛집: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=1200&q=80",
  핫플: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80",
  지역소식: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&q=80",
  광고: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80",
};

const CATEGORY_COLORS: Record<string, string> = {
  행사: "#2563eb", 맛집: "#ea580c", 핫플: "#7c3aed", 지역소식: "#059669", 광고: "#0891b2",
};

interface ContentItem {
  id: string;
  type: "event" | "ad";
  sourceType?: string;
  title: string;
  description: string;
  date: string;
  startDate?: string;
  endDate?: string;
  source: string;
  contact: string;
  link: string;
  category: string;
  thumbnail: string;
  hasThumbnail: boolean;
  videoUrl?: string | null;
  phone?: string;
  location?: string;
  businessName?: string;
  extraImages: string[];
  hashtags: string[];
  socialDraft?: SocialDraft | null;
}


const CARDS_DIR = path.resolve(process.cwd(), "public/cards");

async function hasCardImage(id: string): Promise<boolean> {
  try { await fs.access(path.join(CARDS_DIR, `${id}.png`)); return true; }
  catch { return false; }
}

function crawledEventToContentItem(ev: Awaited<ReturnType<typeof readEvents>>[number]): ContentItem {
  const cat = ev.category || "지역소식";
  return {
    id: ev.id, type: "event",
    title: ev.title, description: ev.description,
    date: ev.date,
    startDate: ev.startDate || undefined,
    endDate: ev.endDate || undefined,
    source: ev.source, contact: ev.contact || "",
    link: ev.link, sourceType: ev.sourceType,
    category: cat,
    thumbnail: ev.thumbnail ?? THUMBNAIL_MAP[cat] ?? THUMBNAIL_MAP["지역소식"]!,
    hasThumbnail: !!ev.thumbnail,
    videoUrl: ev.videoUrl ?? null,
    extraImages: ev.extraImages ?? [],
    hashtags: ev.hashtags ?? [],
    socialDraft: ev.socialDraft ?? null,
    location: ev.location || undefined,
  };
}

async function findContent(id: string): Promise<ContentItem | null> {
  // 1. DB events 직접 조회 (빠른 경로)
  try {
    const rows = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
    if (rows[0]) {
      const ev = rows[0];
      const cat = ev.category || "지역소식";
      return {
        id: ev.id, type: "event",
        title: ev.title, description: ev.description,
        date: ev.date,
        startDate: ev.startDate || undefined,
        endDate: ev.endDate || undefined,
        source: ev.source, contact: ev.contact || "",
        link: ev.link, sourceType: ev.sourceType,
        category: cat,
        thumbnail: ev.thumbnail ?? THUMBNAIL_MAP[cat] ?? THUMBNAIL_MAP["지역소식"]!,
        hasThumbnail: !!ev.thumbnail,
        videoUrl: ev.videoUrl ?? null,
        extraImages: (ev.extraImages as string[] | null) ?? [],
        hashtags: (ev.hashtags as string[] | null) ?? [],
        socialDraft: (ev.socialDraft as SocialDraft | null) ?? null,
        location: ev.location || undefined,
      };
    }
  } catch { /* fall through */ }

  // 2. readEvents() fallback — DB 직접 쿼리가 누락한 항목 보완
  try {
    const stored = await readEvents();
    const ev = stored.find((e) => e.id === id);
    if (ev) return crawledEventToContentItem(ev);
  } catch { /* fall through */ }

  // 3. 광고 테이블 조회
  try {
    const rows = await db.select().from(adsTable).where(eq(adsTable.id, id)).limit(1);
    const ad = rows[0];
    if (ad) {
      return {
        id: ad.id, type: "ad",
        title: ad.title, description: ad.description,
        date: ad.date, source: ad.businessName ?? "광고",
        contact: ad.phone ?? "", link: ad.url ?? "",
        category: ad.category ?? "광고",
        thumbnail: ad.imageUrl ?? THUMBNAIL_MAP["광고"]!,
        hasThumbnail: !!ad.imageUrl,
        phone: ad.phone ?? undefined, location: ad.location ?? undefined,
        businessName: ad.businessName ?? undefined,
        extraImages: [], hashtags: [],
      };
    }
  } catch { /* fall through */ }

  // 4. 404
  return null;
}


// ─── 텍스트 헬퍼 ────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escJs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "");
}

function formatDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d.replace(/\./g, "-"));
  if (isNaN(dt.getTime())) return d;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일 (${days[dt.getDay()]})`;
}

function formatDateRange(startDate?: string, endDate?: string, date?: string): string {
  const sd = startDate || date || "";
  const ed = endDate || startDate || date || "";
  if (!sd) return "";
  const sf = formatDate(sd);
  if (!ed || sd === ed) return sf;
  const ef = formatDate(ed);
  return sf === ef ? sf : `${sf} ~ ${ef}`;
}

/** socialDraft.caption 또는 description 첫 문장으로 한 줄 요약 추출 */
function extractSummary(item: ContentItem): string {
  if (item.socialDraft?.caption) {
    const lines = item.socialDraft.caption
      .split("\n").map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith("#") && !/^[\s#]+$/.test(l));
    if (lines[0] && lines[0].length > 20) return lines[0].slice(0, 155);
  }
  const raw = (item.description || "").replace(/\s+/g, " ").trim();
  const first = raw.split(/[。.!?！？\n]/)[0]?.trim() ?? "";
  return (first.length > 10 ? first : raw).slice(0, 155);
}

/**
 * SEO title — title·location·source 중 어디에도 "강릉"이 없을 때만 SEO <title>에 "강릉" 보강.
 * H1은 원본 title을 그대로 사용하므로 이 함수는 <title> 태그에만 영향을 줌.
 */
function buildPageTitle(item: ContentItem): string {
  const hasGangneung =
    /강릉/.test(item.title) ||
    /강릉/.test(item.location ?? "") ||
    /강릉/.test(item.source);
  const prefix = hasGangneung ? "" : "강릉 ";
  return `${prefix}${item.title} | PLAY강릉`;
}

// ─── 비디오 ─────────────────────────────────────────────────────────────────

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/shorts/")[1]?.split("/")[0] ?? null;
      return u.searchParams.get("v");
    }
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
  } catch { /* noop */ }
  return null;
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

function renderVideoSection(videoUrl: string): string {
  const ytId = extractYoutubeId(videoUrl);
  if (ytId) return `<div class="video-wrap"><iframe src="https://www.youtube.com/embed/${escHtml(ytId)}?rel=0&modestbranding=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="동영상"></iframe></div>`;
  if (isDirectVideo(videoUrl)) return `<div class="video-wrap"><video controls playsinline preload="metadata"><source src="${escHtml(videoUrl)}"><p>동영상을 재생할 수 없습니다. <a href="${escHtml(videoUrl)}" target="_blank" rel="noopener noreferrer">직접 열기</a></p></video></div>`;
  return `<a href="${escHtml(videoUrl)}" target="_blank" rel="noopener noreferrer" class="orig-btn">▶ 동영상 보기</a>`;
}

// ─── JSON-LD ─────────────────────────────────────────────────────────────────

function buildJsonLd(item: ContentItem, contentUrl: string, thumbnailOg: string): object {
  const locationObj = {
    "@type": "Place",
    "name": item.location || "강릉",
    "address": { "@type": "PostalAddress", "streetAddress": item.location || "", "addressLocality": "강릉시", "addressRegion": "강원특별자치도", "addressCountry": "KR" },
  };
  const base = {
    "@context": "https://schema.org",
    "name": item.title,
    "description": (item.description || "").slice(0, 200),
    "url": contentUrl,
    "image": thumbnailOg,
  };
  switch (item.category) {
    case "행사":
      return {
        ...base, "@type": "Event",
        "eventStatus": "https://schema.org/EventScheduled",
        "startDate": item.startDate || item.date || undefined,
        "endDate": item.endDate || item.startDate || item.date || undefined,
        "location": locationObj,
        "organizer": { "@type": "Organization", "name": item.source, "url": SITE_URL },
        "offers": { "@type": "Offer", "availability": "https://schema.org/InStock", "url": contentUrl },
      };
    case "맛집":
      return {
        ...base, "@type": "Restaurant", "servesCuisine": "Korean",
        "address": locationObj.address,
        ...(item.phone ? { "telephone": item.phone } : {}),
        ...(item.link ? { "sameAs": item.link } : {}),
      };
    case "핫플":
      return {
        ...base, "@type": "TouristAttraction",
        "address": locationObj.address,
        ...(item.link ? { "sameAs": item.link } : {}),
      };
    case "광고":
      return {
        ...base, "@type": "LocalBusiness",
        "address": locationObj.address,
        ...(item.phone ? { "telephone": item.phone } : {}),
      };
    default:
      return {
        ...base, "@type": "NewsArticle",
        "headline": item.title,
        "datePublished": item.date || undefined,
        "publisher": { "@type": "Organization", "name": "PLAY강릉", "url": SITE_URL, "logo": { "@type": "ImageObject", "url": `${SITE_URL}/logo.png` } },
        "author": { "@type": "Organization", "name": item.source },
      };
  }
}

// ─── HTML 렌더러 ─────────────────────────────────────────────────────────────

function renderHtml(
  item: ContentItem,
  contentUrl: string,
  cardExists: boolean,
  ogImageOverride?: string | null,
): string {
  const pageTitle = buildPageTitle(item);
  const summary = extractSummary(item);
  const dateStr = formatDateRange(item.startDate, item.endDate, item.date);
  const catColor = CATEGORY_COLORS[item.category] ?? "#2563eb";

  // 히어로 이미지: 카드PNG > thumbnail > 없음(텍스트히어로)
  const cardImageUrl = cardExists ? `/api/cards/${item.id}.png` : null;
  const heroSrc = cardImageUrl ?? (item.hasThumbnail ? proxyUrl(item.thumbnail) : null);
  const heroAlt = `강릉 ${item.category} - ${item.title}`;

  // OG 이미지: 카드PNG > thumbnail > 카테고리 기본
  const thumbnailOg = ogImageOverride
    ?? (item.hasThumbnail ? proxyUrlAbsolute(item.thumbnail) : null)
    ?? (THUMBNAIL_MAP[item.category] ?? THUMBNAIL_MAP["지역소식"]!);

  const descRaw = (item.description || "강릉의 특색 있는 행사와 명소를 소개합니다.")
    .replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  const metaDesc = escHtml(summary || descRaw.slice(0, 155));
  const descDisplay = escHtml(descRaw);
  const titleEsc = escHtml(item.title);

  const hasLink = !!(item.link);
  const hasContact = !!(item.contact) && item.contact !== item.source;

  // 뒤로가기 / 공유
  const backScript = `if(history.length>1){history.back();}else{window.location.href='/';}`;
  const shareTitle = escJs(item.title);
  const shareDesc = escJs(summary);
  const shareUrl = escJs(contentUrl);
  const shareScript = `if(navigator.share){navigator.share({title:'${shareTitle}',text:'${shareDesc}',url:'${shareUrl}'}).catch(function(){});}else{try{navigator.clipboard.writeText('${shareUrl}');alert('링크를 복사했습니다!');}catch(e){alert('링크: ${shareUrl}');}}`;

  // 추가 이미지 슬라이더
  const extraImagesHtml = item.extraImages.length > 0
    ? `<div class="extra-scroll">${item.extraImages.map((src, i) =>
        `<img src="${escHtml(proxyUrl(src))}" alt="강릉 ${escHtml(item.category)} 추가 이미지 ${i + 1}" loading="lazy" class="extra-img" onerror="this.style.display='none'">`
      ).join("")}</div>`
    : "";

  // 해시태그
  const hashtagsHtml = item.hashtags.length > 0
    ? `<div class="hashtag-row" aria-label="해시태그">${item.hashtags.map(tag =>
        `<span class="hashtag-badge">${escHtml(tag.startsWith("#") ? tag : "#" + tag)}</span>`
      ).join("")}</div>`
    : "";

  const jsonLd = buildJsonLd(item, contentUrl, thumbnailOg);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>${escHtml(pageTitle)}</title>
<meta name="description" content="${metaDesc}">
<link rel="canonical" href="${escHtml(contentUrl)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="PLAY강릉">
<meta property="og:title" content="${titleEsc}">
<meta property="og:description" content="${metaDesc}">
<meta property="og:image" content="${escHtml(thumbnailOg)}">
<meta property="og:image:alt" content="${escHtml(heroAlt)}">
<meta property="og:image:width" content="${ogImageOverride ? "1080" : "1200"}">
<meta property="og:image:height" content="${ogImageOverride ? "1080" : "630"}">
<meta property="og:url" content="${escHtml(contentUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titleEsc}">
<meta name="twitter:description" content="${metaDesc}">
<meta name="twitter:image" content="${escHtml(thumbnailOg)}">
<meta name="twitter:image:alt" content="${escHtml(heroAlt)}">
<meta name="theme-color" content="#1d4ed8">
<meta name="robots" content="index, follow">
<link rel="preconnect" href="https://images.unsplash.com">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif;background:#f8fafc;color:#1e293b;min-height:100vh;padding-bottom:80px}
a{text-decoration:none;color:inherit}
img{max-width:100%;display:block}
.page-wrap{max-width:680px;margin:0 auto}
/* ── 헤더 ── */
.header{position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px;padding:10px 16px;min-height:48px}
.header-logo{height:24px;object-fit:contain}
.header-back{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#f1f5f9;color:#475569;font-size:18px;flex-shrink:0;cursor:pointer;border:none}
.header-title{font-size:13px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
/* ── 네비바 ── */
.nav-bar{display:flex;align-items:center;gap:6px;padding:8px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;overflow-x:auto;white-space:nowrap}
.nav-btn{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:none;background:transparent;text-decoration:none;flex-shrink:0}
.nav-btn-back{background:#e2e8f0;color:#334155}
.nav-btn-home{background:#dbeafe;color:#1d4ed8}
.nav-sep{color:#cbd5e1;font-size:11px;flex-shrink:0}
/* ── 히어로 이미지 ── */
.hero{width:100%;overflow:hidden;background:#000;line-height:0}
.hero img{width:100%;height:280px;object-fit:cover;object-position:center top}
.hero img.card-hero{object-fit:contain;background:#fff;height:auto;max-height:420px}
/* ── 텍스트 히어로 (이미지 없을 때) ── */
.hero-text{display:flex;flex-direction:column;justify-content:flex-end;padding:28px 16px 20px;min-height:160px}
.hero-text-subtitle{font-size:12px;color:rgba(255,255,255,.75);margin-top:5px}
/* ── 제목 영역 ── */
.title-area{background:#fff;padding:14px 16px 12px;border-bottom:1px solid #f1f5f9}
.category-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;color:#fff;margin-bottom:8px}
.main-title{font-size:18px;font-weight:800;color:#0f172a;line-height:1.4;word-break:keep-all;margin-bottom:6px}
.summary-text{font-size:13px;color:#475569;line-height:1.6;word-break:keep-all}
/* ── 추가 이미지 ── */
.extra-scroll{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:12px 16px 4px}
.extra-scroll::-webkit-scrollbar{height:3px}
.extra-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:2px}
.extra-img{width:150px;height:110px;object-fit:cover;border-radius:10px;flex-shrink:0;scroll-snap-align:start;background:#e2e8f0}
/* ── 콘텐츠 ── */
.content{padding:14px 16px}
/* ── 정보 카드 ── */
.info-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:14px;display:flex;flex-direction:column;gap:9px}
.info-row{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:#334155;line-height:1.4}
.info-icon{flex-shrink:0;color:#94a3b8;margin-top:1px}
.info-label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em}
.source-pill{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#64748b;background:#f1f5f9;border-radius:6px;padding:2px 8px;border:1px solid #e2e8f0}
/* ── 섹션 공통 ── */
.section-h2{font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px}
.divider{height:1px;background:#f1f5f9;margin:14px 0}
/* ── 상세 내용 ── */
.description{font-size:14px;line-height:1.85;color:#334155;word-break:keep-all;white-space:pre-wrap}
/* ── 문의 ── */
.contact-box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:12px 14px;margin-bottom:14px}
.contact-label{font-size:10px;font-weight:700;color:#0369a1;margin-bottom:3px}
.contact-value{font-size:13px;font-weight:600;color:#0c4a6e}
/* ── 원본 버튼 ── */
.orig-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:13px;border-radius:12px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#2563eb;text-align:center;margin-top:4px}
/* ── 해시태그 ── */
.hashtag-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.hashtag-badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
/* ── 동영상 ── */
.video-wrap{position:relative;width:100%;padding-bottom:56.25%;background:#000;border-radius:12px;overflow:hidden;margin:10px 0}
.video-wrap iframe,.video-wrap video{position:absolute;inset:0;width:100%;height:100%;border:none;object-fit:contain}
.video-label{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
/* ── 하단 바 ── */
.bottom-bar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e2e8f0;padding:10px 16px;display:flex;gap:8px;z-index:50;box-shadow:0 -2px 12px rgba(0,0,0,.07)}
.btn{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:11px 6px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:none;transition:opacity .15s;text-decoration:none}
.btn:active{opacity:.75}
.btn-primary{background:#2563eb;color:#fff}
.btn-secondary{background:#f1f5f9;color:#1e293b}
.btn-share{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
/* ── 브랜드 푸터 ── */
.brand-footer{text-align:center;padding:16px 16px 8px;font-size:11px;color:#94a3b8}
/* ── PC ── */
@media(min-width:640px){
  .hero img{height:380px}
  .hero img.card-hero{max-height:520px}
  .main-title{font-size:22px}
  .content{padding:18px 24px}
  .description{font-size:15px}
  .extra-scroll{padding:12px 24px 4px}
  .bottom-bar{max-width:680px;left:50%;transform:translateX(-50%);width:100%}
}
/* ── 스크린리더 전용 ── */
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}
</style>
</head>
<body>

<!-- 헤더 -->
<header class="header">
  <button class="header-back" onclick="${escHtml(backScript)}" aria-label="뒤로 가기">‹</button>
  <img src="/logo2.png" alt="PLAY강릉" class="header-logo">
  <span class="header-title" aria-hidden="true">${titleEsc}</span>
</header>

<!-- 네비게이션 바 -->
<nav class="nav-bar" aria-label="페이지 탐색">
  <button class="nav-btn nav-btn-back" onclick="${escHtml(backScript)}">← 돌아가기</button>
  <span class="nav-sep" aria-hidden="true">|</span>
  <a href="/" class="nav-btn nav-btn-home">🏠 PLAY강릉 홈</a>
</nav>

<div class="page-wrap">

  <!-- 1. 대표 이미지 -->
  ${heroSrc ? `<div class="hero">
    <img src="${escHtml(heroSrc)}" alt="${escHtml(heroAlt)}" loading="eager" fetchpriority="high"${cardExists ? ' class="card-hero"' : ""}>
  </div>` : ""}

  <!-- 2. 제목 영역 (카테고리 → H1 → 한 줄 요약) -->
  ${heroSrc
    ? `<div class="title-area">
        <span class="category-pill" style="background:${catColor}">${escHtml(item.category)}</span>
        <h1 class="main-title">${titleEsc}</h1>
        ${summary ? `<p class="summary-text">${escHtml(summary)}</p>` : ""}
      </div>`
    : `<div class="hero-text" style="background:linear-gradient(135deg,${catColor}dd,${catColor}99)">
        <span class="category-pill" style="background:rgba(255,255,255,.25)">${escHtml(item.category)}</span>
        <h1 class="main-title" style="color:#fff">${titleEsc}</h1>
        ${summary ? `<p class="hero-text-subtitle">${escHtml(summary)}</p>` : ""}
      </div>`
  }

  <!-- 추가 이미지 슬라이더 -->
  ${extraImagesHtml}

  <div class="content">

    <!-- 동영상 -->
    ${item.videoUrl ? `<p class="video-label">▶ 동영상</p>${renderVideoSection(item.videoUrl)}<div class="divider"></div>` : ""}

    <!-- 문의 -->
    ${hasContact ? `<div class="contact-box">
      <p class="contact-label">📞 문의처</p>
      <p class="contact-value">${escHtml(item.contact)}</p>
    </div>` : ""}

    <!-- 5. 상세 내용 -->
    <section aria-labelledby="detail-title">
      <h2 id="detail-title" class="section-h2">상세 내용</h2>
      <p class="description">${descDisplay}</p>
    </section>

    <!-- 해시태그 -->
    ${hashtagsHtml}

    <!-- 핵심 정보 카드 -->
    <section aria-labelledby="info-title" style="margin-top:16px">
      <h2 id="info-title" class="sr-only">핵심 정보</h2>
      <div class="info-card">
        ${dateStr ? `<div class="info-row">
          <span class="info-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
          <span>${escHtml(dateStr)}</span>
        </div>` : ""}
        ${item.location ? `<div class="info-row">
          <span class="info-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
          <div><span class="info-label">장소/주소</span><div style="margin-top:2px">${escHtml(item.location)}</div></div>
        </div>` : ""}
        <div class="info-row">
          <span class="info-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg></span>
          <span class="source-pill">출처: ${escHtml(item.source)}</span>
        </div>
        ${hasLink ? `<div class="info-row">
          <span class="info-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg></span>
          <a href="${escHtml(item.link)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;font-size:12px;word-break:break-all">${escHtml(new URL(item.link).hostname.replace(/^www\./, ""))}</a>
        </div>` : ""}
      </div>
    </section>

  </div>

  <!-- 브랜드 푸터 -->
  <div class="brand-footer">
    강릉의 모든 것 · PLAY강릉<br>
    <a href="${SITE_URL}" style="color:#2563eb">playgangneung.com</a>
  </div>
</div>

<!-- 고정 하단 버튼 -->
<div class="bottom-bar">
  <button class="btn btn-share" onclick="${escHtml(shareScript)}">📤 공유하기</button>
  ${hasLink
    ? `<a href="${escHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">🔗 원본 보기</a>`
    : ""}
  <a href="/" class="btn btn-secondary">🏠 홈</a>
</div>

</body>
</html>`;
}

// ─── 라우터 ──────────────────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const contentUrl = `${SITE_URL}/content/${id}`;

  const [item, cardExists] = await Promise.all([findContent(id), hasCardImage(id)]);

  if (!item) {
    res.status(404).send(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>찾을 수 없음 | PLAY강릉</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;color:#1e293b;text-align:center;padding:20px}h1{font-size:22px;margin-bottom:8px}p{color:#64748b;font-size:14px}a{color:#2563eb;font-weight:600}</style></head><body><div><h1>😔 콘텐츠를 찾을 수 없어요</h1><p>삭제되었거나 잘못된 링크입니다.</p><br><a href="${SITE_URL}">PLAY강릉 홈으로</a></div></body></html>`);
    return;
  }

  const ogImageOverride = cardExists ? `${SITE_URL}/api/cards/${id}.png` : null;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(renderHtml(item, contentUrl, cardExists, ogImageOverride));
});

export default router;
