import { Router } from "express";
import { readEvents } from "../lib/storage.js";
import fs from "fs/promises";
import path from "path";

const router = Router();

const DATA_DIR = path.resolve(process.cwd(), "data");
const ADS_FILE = path.join(DATA_DIR, "ads.json");

const SITE_URL = process.env["SITE_URL"] ?? "https://play-gangneung-dashboard.replit.app";

const PROXY_HOSTS = ["www.gn.go.kr", "gn.go.kr", "gn.moonhwain.net", "www.gncaf.or.kr", "gncaf.or.kr"];

/** 브라우저 직접 로딩용 — 상대 프록시 경로 반환 */
function proxyUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    if (PROXY_HOSTS.includes(hostname)) {
      return `/api/proxy/image?url=${encodeURIComponent(url)}`;
    }
  } catch { /* noop */ }
  return url;
}

/** OG 메타태그용 — 절대 경로 프록시 URL 반환 (크롤러 접근 가능) */
function proxyUrlAbsolute(url: string): string {
  try {
    const { hostname } = new URL(url);
    if (PROXY_HOSTS.includes(hostname)) {
      return `${SITE_URL}/api/proxy/image?url=${encodeURIComponent(url)}`;
    }
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


interface ContentItem {
  id: string;
  type: "event" | "ad";
  title: string;
  description: string;
  date: string;
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
}

const CARDS_DIR = path.resolve(process.cwd(), "public/cards");

async function hasCardImage(id: string): Promise<boolean> {
  try {
    await fs.access(path.join(CARDS_DIR, `${id}.png`));
    return true;
  } catch {
    return false;
  }
}

async function findContent(id: string): Promise<ContentItem | null> {
  // Check events
  try {
    const stored = await readEvents();
    const ev = stored.find((e) => e.id === id);
    if (ev) {
      const category = (ev as any).category ?? "지역소식";
      const rawThumb = (ev as any).thumbnail as string | null | undefined;
      return {
        id: ev.id, type: "event",
        title: ev.title, description: ev.description,
        date: ev.date, source: ev.source, contact: (ev as any).contact ?? "", link: ev.link,
        category,
        thumbnail: rawThumb ?? THUMBNAIL_MAP[category] ?? THUMBNAIL_MAP["지역소식"],
        hasThumbnail: !!rawThumb,
        videoUrl: (ev as any).videoUrl ?? null,
      };
    }
  } catch {}

  // Check ads
  try {
    const raw = await fs.readFile(ADS_FILE, "utf-8");
    const ads = JSON.parse(raw) as any[];
    const ad = ads.find((a: any) => a.id === id);
    if (ad) {
      return {
        id: ad.id, type: "ad",
        title: ad.title, description: ad.description,
        date: ad.date, source: ad.businessName ?? "광고", contact: ad.phone ?? "", link: ad.url ?? "",
        category: ad.category ?? "광고",
        thumbnail: ad.imageUrl ?? THUMBNAIL_MAP["광고"],
        hasThumbnail: !!ad.imageUrl,
        phone: ad.phone, location: ad.location, businessName: ad.businessName,
      };
    }
  } catch {}

  return null;
}

function formatDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d.replace(/\./g, "-"));
  if (isNaN(dt.getTime())) return d;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일 (${days[dt.getDay()]})`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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
  if (ytId) {
    return `<div class="video-wrap"><iframe src="https://www.youtube.com/embed/${escHtml(ytId)}?rel=0&modestbranding=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="동영상"></iframe></div>`;
  }
  if (isDirectVideo(videoUrl)) {
    return `<div class="video-wrap"><video controls playsinline preload="metadata"><source src="${escHtml(videoUrl)}"><p>동영상을 재생할 수 없습니다. <a href="${escHtml(videoUrl)}" target="_blank" rel="noopener noreferrer">직접 열기</a></p></video></div>`;
  }
  return `<a href="${escHtml(videoUrl)}" target="_blank" rel="noopener noreferrer" class="orig-link">▶ 동영상 보기</a>`;
}

function renderHtml(item: ContentItem, contentUrl: string, ogImageOverride?: string | null): string {
  const title = escHtml(item.title);
  const desc = escHtml(item.description || "강릉의 특색 있는 행사와 명소를 소개합니다.");
  const descShort = desc.length > 120 ? desc.slice(0, 117) + "..." : desc;
  const dateStr = formatDate(item.date);
  const thumbnailHero = proxyUrl(item.thumbnail);
  // OG 이미지 우선순위: 카드이미지(생성된 경우) > 실제 썸네일 > 카테고리 기본 이미지
  const thumbnailOg = ogImageOverride
    ?? (item.hasThumbnail ? proxyUrlAbsolute(item.thumbnail) : null)
    ?? (THUMBNAIL_MAP[item.category] ?? THUMBNAIL_MAP["지역소식"]);

  const categoryColors: Record<string, string> = {
    행사: "#2563eb", 맛집: "#ea580c", 핫플: "#7c3aed", 지역소식: "#059669", 광고: "#0891b2",
  };
  const catColor = categoryColors[item.category] ?? "#2563eb";

  const hasMap = !!(item.location);
  const hasPhone = !!(item.phone);
  const hasLink = !!(item.link);

  const actionButtons: string[] = [];
  if (hasMap) actionButtons.push(`<a href="https://map.kakao.com/link/search/${encodeURIComponent(item.location!)}" class="btn btn-secondary">🗺️ 지도 보기</a>`);
  if (hasPhone) actionButtons.push(`<a href="tel:${item.phone}" class="btn btn-secondary">📞 전화하기</a>`);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>${title} | PLAY강릉</title>
<meta name="description" content="${descShort}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="PLAY강릉">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${descShort}">
<meta property="og:image" content="${escHtml(thumbnailOg)}">
<meta property="og:image:width" content="${ogImageOverride ? "1080" : "1200"}">
<meta property="og:image:height" content="${ogImageOverride ? "1080" : "630"}">
<meta property="og:url" content="${escHtml(contentUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${descShort}">
<meta name="twitter:image" content="${escHtml(thumbnailOg)}">
<meta name="theme-color" content="#1d4ed8">
<link rel="preconnect" href="https://images.unsplash.com">
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif;background:#f8fafc;color:#1e293b;min-height:100vh;padding-bottom:88px}
a{text-decoration:none;color:inherit}
/* 페이지 최대 너비 래퍼 */
.page-wrap{max-width:680px;margin:0 auto}
/* Header */
.header{position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px;padding:10px 16px;min-height:48px}
.header-logo{height:24px;object-fit:contain}
.header-back{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#f1f5f9;color:#475569;font-size:18px;flex-shrink:0}
.header-title{font-size:13px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
/* Hero 이미지 */
.hero{position:relative;width:100%;background:#000;overflow:hidden;max-height:300px}
.hero img{width:100%;height:300px;display:block;object-fit:cover;object-position:center top}
.hero-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,rgba(0,0,0,.0) 55%)}
.hero-meta{position:absolute;bottom:14px;left:16px;right:16px}
.category-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;color:#fff;margin-bottom:6px}
.hero-title{font-size:17px;font-weight:800;color:#fff;line-height:1.35;text-shadow:0 1px 4px rgba(0,0,0,.4)}
/* Text hero (이미지 없을 때) */
.hero-text{position:relative;width:100%;min-height:140px;display:flex;flex-direction:column;justify-content:flex-end;padding:18px 16px 14px}
.hero-text-title{font-size:18px;font-weight:800;color:#fff;line-height:1.4;margin-bottom:5px;word-break:keep-all}
.hero-text-meta{font-size:11px;color:rgba(255,255,255,.75)}
/* Content */
.content{padding:14px 16px}
.info-row{display:flex;align-items:center;gap:6px;font-size:12px;color:#64748b;margin-bottom:5px}
.info-row svg{flex-shrink:0}
.divider{height:1px;background:#e2e8f0;margin:12px 0}
.section-title{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px}
.description{font-size:14px;line-height:1.75;color:#334155;white-space:pre-wrap;word-break:keep-all}
/* Source */
.source-tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#94a3b8;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:2px 8px}
.source-link{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:#2563eb;padding:8px 0}
/* Contact box */
.contact-box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px 14px}
.contact-label{font-size:10px;font-weight:700;color:#0369a1;margin-bottom:3px}
.contact-value{font-size:13px;font-weight:600;color:#0c4a6e}
/* 원본 링크 버튼 (iframe 대체) */
.orig-link{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:10px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#2563eb;text-align:center}
/* Bottom bar */
.bottom-bar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e2e8f0;padding:10px 16px;display:flex;gap:8px;z-index:50;box-shadow:0 -2px 12px rgba(0,0,0,.08)}
.btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px 8px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:none;transition:opacity .15s}
.btn:active{opacity:.75}
.btn-primary{background:#2563eb;color:#fff}
.btn-secondary{background:#f1f5f9;color:#1e293b}
/* PLAY강릉 brand footer */
.brand-footer{text-align:center;padding:16px 16px 6px;font-size:11px;color:#94a3b8}
/* 동영상 */
.video-wrap{position:relative;width:100%;padding-bottom:56.25%;background:#000;border-radius:12px;overflow:hidden;margin:12px 0}
.video-wrap iframe,.video-wrap video{position:absolute;inset:0;width:100%;height:100%;border:none;object-fit:contain}
.video-label{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;margin-top:12px}
/* PC (640px 이상) */
@media(min-width:640px){
  .hero{max-height:380px}
  .hero img{height:380px}
  .hero-title{font-size:22px}
  .hero-text{min-height:160px}
  .hero-text-title{font-size:20px}
  .content{padding:18px 24px}
  .description{font-size:15px}
  .bottom-bar{max-width:680px;left:50%;transform:translateX(-50%);width:100%}
}
</style>
</head>
<body>
<!-- Header (full width, sticky) -->
<header class="header">
  <a href="${SITE_URL}" class="header-back" aria-label="PLAY강릉 홈으로">‹</a>
  <img src="/logo2.png" alt="PLAY강릉" class="header-logo">
  <span class="header-title">${title}</span>
</header>

<div class="page-wrap">
  <!-- Hero -->
  ${item.hasThumbnail ? `
  <div class="hero">
    <img src="${escHtml(thumbnailHero)}" alt="${title}" loading="eager" fetchpriority="high">
    <div class="hero-overlay"></div>
    <div class="hero-meta">
      <div class="category-badge" style="background:${catColor}">${escHtml(item.category)}</div>
      <h1 class="hero-title">${title}</h1>
    </div>
  </div>` : `
  <div class="hero-text" style="background:linear-gradient(135deg,${catColor}dd,${catColor}99)">
    <div class="category-badge" style="background:rgba(255,255,255,.2);display:inline-block;margin-bottom:8px">${escHtml(item.category)}</div>
    <h1 class="hero-text-title">${title}</h1>
    <p class="hero-text-meta">${escHtml(item.source)}${dateStr ? " · " + escHtml(dateStr) : ""}</p>
  </div>`}

  <!-- Info -->
  <div class="content">
    ${dateStr ? `<div class="info-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${escHtml(dateStr)}</div>` : ""}
    ${item.location ? `<div class="info-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${escHtml(item.location)}</div>` : ""}
    <div class="info-row"><span class="source-tag">출처: ${escHtml(item.source)}</span></div>

    ${item.videoUrl ? `
    <div class="divider"></div>
    <p class="video-label">▶ 동영상</p>
    ${renderVideoSection(item.videoUrl)}` : ""}

    <div class="divider"></div>
    <div class="contact-box">
      <p class="contact-label">📞 문의처</p>
      <p class="contact-value">${escHtml(item.contact || item.source)}</p>
    </div>

    <div class="divider"></div>
    <p class="section-title">상세 내용</p>
    <p class="description">${desc}</p>

    ${hasLink ? `
    <div class="divider"></div>
    <a href="${escHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="orig-link">
      🔗 원본 페이지에서 자세히 보기
    </a>` : ""}
  </div>

  <!-- Brand footer -->
  <div class="brand-footer">
    강릉의 모든 것 · PLAY강릉<br>
    <a href="${SITE_URL}" style="color:#2563eb">playgangneung.com</a>
  </div>
</div>

<!-- Bottom action bar (full width) -->
${actionButtons.length > 0 ? `<div class="bottom-bar">${actionButtons.join("")}</div>` : ""}

</body>
</html>`;
}

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const contentUrl = `${SITE_URL}/content/${id}`;

  const item = await findContent(id);

  if (!item) {
    res.status(404).send(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>찾을 수 없음 | PLAY강릉</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;color:#1e293b;text-align:center;padding:20px}h1{font-size:22px;margin-bottom:8px}p{color:#64748b;font-size:14px}a{color:#2563eb;font-weight:600}</style></head><body><div><h1>😔 콘텐츠를 찾을 수 없어요</h1><p>삭제되었거나 잘못된 링크입니다.</p><br><a href="${SITE_URL}">PLAY강릉 홈으로</a></div></body></html>`);
    return;
  }

  // 카드이미지가 생성돼 있으면 OG 이미지로 우선 사용 (Facebook 링크 미리보기 최적화)
  const cardExists = await hasCardImage(id);
  const ogImageOverride = cardExists ? `${SITE_URL}/api/cards/${id}.png` : null;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(renderHtml(item, contentUrl, ogImageOverride));
});

export default router;
