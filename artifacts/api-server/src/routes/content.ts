import { Router } from "express";
import { db, eventsTable, adsTable, type ContentBlock } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { readEvents, type SocialDraft } from "../lib/storage.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
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
  contentBlocks?: ContentBlock[] | null;
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
    contentBlocks: ev.contentBlocks ?? null,
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
        contentBlocks: (ev.contentBlocks as ContentBlock[] | null) ?? null,
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

// ── 관리자 패널 HTML (토글바 + 패널 div) ─ 어드민 인증 확인 후에만 사용 ──
function renderAdminSnsHtml(item: ContentItem, contentUrl: string): string {
  const caption = item.socialDraft?.caption ?? "";
  const hashtags = (item.socialDraft?.hashtags ?? []).map((h) => h.startsWith("#") ? h : `#${h}`).join(" ");
  const captionEsc = escHtml(caption);
  const hashtagsEsc = escHtml(hashtags);
  const contentUrlEsc = escHtml(contentUrl);
  const originalLinkLine = item.link ? escHtml(`🔗 원문보기 👉 ${item.link}\n`) : "";
  const editUrl = escHtml(`/admin/events/${item.id}`);

  return `
<div class="admin-toggle-bar">
  <button class="admin-toggle-btn" id="adminToggleBtn" onclick="adminTogglePanel()">🛠️ SNS 공유 관리</button>
</div>
<div class="admin-sns" id="adminSnsPanel" style="display:none">
  <div class="admin-sns-header">
    <span>🛠️ SNS 공유</span>
    <a href="${editUrl}" class="admin-edit-btn">✏️ 강릉노트 편집</a>
  </div>
  <div class="admin-sns-section">
    <div class="admin-row-between">
      <span class="admin-label">① SNS 문구</span>
      <button class="admin-btn-sm admin-btn-outline" onclick="adminGenerateDraft()">🤖 AI 재생성</button>
    </div>
    ${caption
      ? `<pre class="admin-caption" id="captionPre">${captionEsc}</pre>
         <p class="admin-hashtags" id="hashtagsPre">${hashtagsEsc}</p>`
      : `<p class="admin-no-draft">아직 SNS 문구가 없습니다. AI 재생성을 눌러주세요.</p>`
    }
    <div class="admin-cta-box">
      <span class="admin-cta-label">📢 공통 링크 (복사 시 자동 첨부)</span>
      <pre class="admin-cta-text">${originalLinkLine}📍 강릉 더보기 👉 ${contentUrlEsc}</pre>
    </div>
    <div class="admin-row-gap">
      <button class="admin-btn admin-btn-violet" id="copyAllBtn" onclick="adminCopyAll()">📋 전체 복사</button>
      <button class="admin-btn admin-btn-teal" onclick="adminGenCard()">🖼️ 카드이미지 생성</button>
    </div>
  </div>
  <div class="admin-sns-section">
    <span class="admin-label">② SNS 채널 열기</span>
    <div class="admin-row-gap" style="margin-top:8px">
      <button class="admin-btn admin-btn-link-copy" onclick="adminCopyLink()">🔗 링크 복사</button>
      <a href="https://business.facebook.com/latest/composer?asset_id=1135888279600983&business_id=1004678568916594&ir_qe_exposed=1&nav_ref=internal_nav&ref=biz_web_content_manager_calendar_view&context_ref=CONTENT_CALENDAR" target="_blank" rel="noopener noreferrer" class="admin-btn admin-btn-meta">🏢 Meta</a>
      <a href="https://www.facebook.com/profile.php?id=61589314617028&locale=ko_KR" target="_blank" rel="noopener noreferrer" class="admin-btn admin-btn-fb">📘 FB</a>
      <a href="https://www.instagram.com/playgangneung/" target="_blank" rel="noopener noreferrer" class="admin-btn admin-btn-ig">📸 IG</a>
    </div>
    <p class="admin-guide">① 전체 복사 → ② 채널 열기 → ③ 붙여넣기 & 게시</p>
  </div>
  <div id="adminToast" class="admin-toast" style="display:none"></div>
</div>`;
}

// ── 관리자 JS 함수 정의 (script 태그 없음, 어드민 인증 후에만 실행) ──
// 서버사이드 렌더링과 API 엔드포인트 /content/:id/admin-panel 양쪽에서 사용
function buildAdminFunctionsJs(item: ContentItem, contentUrl: string): string {
  const caption = item.socialDraft?.caption ?? "";
  const hashtags = (item.socialDraft?.hashtags ?? []).map((h) => h.startsWith("#") ? h : `#${h}`).join(" ");
  const copyPayload = escJs([caption, hashtags, item.link ? `🔗 원문보기 👉 ${item.link}` : "", `📍 강릉 더보기 👉 ${contentUrl}`].filter(Boolean).join("\n\n"));
  const itemIdJs     = escJs(item.id);
  const contentUrlJs = escJs(contentUrl);
  const itemLinkJs   = escJs(item.link || "");

  return `(function(){
  var _id  = '${itemIdJs}';
  var _cu  = '${contentUrlJs}';
  var _lnk = '${itemLinkJs}';
  var _cp  = '${copyPayload}';

  function _toast(msg) {
    var t = document.getElementById('adminToast');
    if (!t) return;
    t.textContent = msg; t.style.display = 'block';
    setTimeout(function(){ t.style.display = 'none'; }, 2500);
  }
  function _hdrs() {
    var h = { 'Content-Type': 'application/json' };
    var tok = localStorage.getItem('pg_admin_token');
    if (tok) h['Authorization'] = 'Bearer ' + tok;
    return h;
  }

  window.adminTogglePanel = function() {
    var p = document.getElementById('adminSnsPanel');
    var b = document.getElementById('adminToggleBtn');
    if (!p || !b) return;
    var open = p.style.display === 'none' || p.style.display === '';
    p.style.display = open ? 'block' : 'none';
    b.textContent   = open ? '\u2715 SNS \uacf5\uc720 \uad00\ub9ac \ub2eb\uae30' : '\uD83D\uDEE0\uFE0F SNS \uacf5\uc720 \uad00\ub9ac';
  };
  window.adminCopyAll = function() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(_cp).then(function(){
        var b = document.getElementById('copyAllBtn');
        if (b) { b.textContent = '\u2705 \ubcf5\uc0ac\ub428!'; setTimeout(function(){ b.textContent = '\uD83D\uDCCB \uc804\uccb4 \ubcf5\uc0ac'; }, 2500); }
        _toast('\uce90\uc158 \ubcf5\uc0ac \uc644\ub8cc \u2014 \uc778\uc2a4\ud0c0\u00b7\ud398\ubd81\uc5d0 \ubd99\uc5ec\ub123\uc73c\uc138\uc694.');
      });
    } else { _toast('\ub9c1\ud06c: ' + _cu); }
  };
  window.adminCopyLink = function() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(_cu).then(function(){ _toast('PLAY\uac15\ub989 \ub9c1\ud06c \ubcf5\uc0ac\ub428'); });
    }
  };
  window.adminGenerateDraft = async function() {
    _toast('AI \ubb38\uad6c \uc0dd\uc131 \uc911...');
    try {
      var r = await fetch('/api/events/' + _id + '/draft', { method: 'POST', credentials: 'include', headers: _hdrs() });
      if (!r.ok) { _toast('\uc0dd\uc131 \uc2e4\ud328'); return; }
      _toast('\ubb38\uad6c \uc0dd\uc131 \uc644\ub8cc! \uc0c8\ub85c\uace0\uce68\ud569\ub2c8\ub2e4.');
      setTimeout(function(){ location.reload(); }, 1200);
    } catch(e) { _toast('\uc624\ub958: ' + e.message); }
  };
  window.adminGenCard = async function() {
    _toast('\uce74\ub4dc\uc774\ubbf8\uc9c0 \uc0dd\uc131 \uc911...');
    try {
      var r = await fetch('/api/events/' + _id + '/card', { method: 'POST', credentials: 'include', headers: _hdrs() });
      if (!r.ok) { _toast('\uc0dd\uc131 \uc2e4\ud328'); return; }
      _toast('\uce74\ub4dc\uc774\ubbf8\uc9c0 \uc0dd\uc131 \uc644\ub8cc! \uc0c8\ub85c\uace0\uce68\ud569\ub2c8\ub2e4.');
      setTimeout(function(){ location.reload(); }, 1200);
    } catch(e) { _toast('\uc624\ub958: ' + e.message); }
  };
})();`;
}

// ── 서버사이드 세션 쿠키 인증 성공 시 렌더링 (HTML + JS, 어드민만 수신) ──
function renderAdminSnsPanel(item: ContentItem, contentUrl: string): string {
  return `${renderAdminSnsHtml(item, contentUrl)}
<script>
${buildAdminFunctionsJs(item, contentUrl)}
</script>`;
}

// ── 보호 API 응답용: {html, js} — /content/:id/admin-panel 에서 반환 ──
function renderAdminPanelPayload(item: ContentItem, contentUrl: string): { html: string; js: string } {
  return {
    html: renderAdminSnsHtml(item, contentUrl),
    js: buildAdminFunctionsJs(item, contentUrl),
  };
}

// ── 항상 포함되는 최소 클라이언트 스크립트 ──
// 어드민 문자열 완전 없음. ITEM_ID + Bearer 체크 + 보호 API fetch + 주입만 수행.
function renderAdminPanelJs(item: ContentItem): string {
  const itemIdJs = escJs(item.id);
  return `<script>
(function(){
  if (document.getElementById('adminToggleBtn')) return;
  var _tok = localStorage.getItem('pg_admin_token');
  if (!_tok) return;
  var _pgid = '${itemIdJs}';
  var _hdr  = { 'Authorization': 'Bearer ' + _tok };
  fetch('/api/auth/me', { credentials: 'include', headers: _hdr })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){
      if (!d || !d.isAdmin) return null;
      return fetch('/content/' + _pgid + '/admin-panel', { credentials: 'include', headers: _hdr });
    })
    .then(function(r){ return r && r.ok ? r.json() : null; })
    .then(function(p){
      if (!p) return;
      var wrap = document.createElement('div');
      wrap.innerHTML = p.html;
      while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
      var sc = document.createElement('script');
      sc.textContent = p.js;
      document.head.appendChild(sc);
    })
    .catch(function(){});
})();
</script>`;
}

function renderHtml(
  item: ContentItem,
  contentUrl: string,
  cardExists: boolean,
  ogImageOverride?: string | null,
  isAdmin = false,
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

  // metaDesc용: 단일 줄로 정제
  const descRaw = (item.description || "강릉의 특색 있는 행사와 명소를 소개합니다.")
    .replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  const metaDesc = escHtml(summary || descRaw.slice(0, 155));
  // descDisplay: 줄바꿈 보존 (CSS white-space:pre-wrap 활용)
  const descDisplay = escHtml((item.description || "강릉의 특색 있는 행사와 명소를 소개합니다.").trim());
  const titleEsc = escHtml(item.title);

  const hasLink = !!(item.link);
  const hasContact = !!(item.contact) && item.contact !== item.source;
  const hasMedia = item.extraImages.length > 0 || !!(item.videoUrl);

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

  // 추가 콘텐츠 블록
  const contentBlocksHtml = (item.contentBlocks && item.contentBlocks.length > 0)
    ? item.contentBlocks.map((block) => {
        if (block.type === "text") return `<p class="block-text">${escHtml(block.content)}</p>`;
        if (block.type === "image") return `<img src="${escHtml(proxyUrl(block.content))}" alt="추가 이미지" class="block-img" loading="lazy" onerror="this.style.display='none'">`;
        if (block.type === "video") return renderVideoSection(block.content);
        return "";
      }).join("")
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
/* ── 헤더: 뒤로가기 | 로고 | 공유 ── */
.header{position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px;padding:10px 16px;min-height:52px}
.header-logo{height:26px;object-fit:contain;flex:1}
.header-back{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#f1f5f9;color:#475569;font-size:20px;flex-shrink:0;cursor:pointer;border:none}
.header-share{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#f0fdf4;color:#15803d;font-size:16px;flex-shrink:0;cursor:pointer;border:1px solid #bbf7d0}
/* ── 히어로 이미지 ── */
.hero{width:100%;overflow:hidden;background:#fff;line-height:0}
.hero img{width:100%;object-fit:contain;background:#fff}
.hero img.card-hero{background:#fff}
/* ── 텍스트 히어로 (이미지 없을 때) ── */
.hero-text{display:flex;flex-direction:column;justify-content:flex-end;padding:32px 16px 20px;min-height:140px}
.hero-text-subtitle{font-size:12px;color:rgba(255,255,255,.75);margin-top:5px}
/* ── 제목 영역 ── */
.title-area{background:#fff;padding:16px 16px 14px;border-bottom:1px solid #f1f5f9}
.category-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;color:#fff;margin-bottom:10px}
.main-title{font-size:20px;font-weight:800;color:#0f172a;line-height:1.4;word-break:keep-all;margin-bottom:8px}
.summary-text{font-size:13px;color:#475569;line-height:1.6;word-break:keep-all}
/* ── 콘텐츠 ── */
.content{padding:16px 16px 4px}
/* ── 섹션 H2 ── */
.section-h2{font-size:15px;font-weight:700;color:#1e293b;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
/* ── 정보 카드 ── */
.info-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:4px;display:flex;flex-direction:column;gap:10px}
.info-row{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:#334155;line-height:1.4}
.info-icon{flex-shrink:0;color:#94a3b8;margin-top:2px}
.info-label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:2px}
.source-pill{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#64748b;background:#f1f5f9;border-radius:6px;padding:2px 8px;border:1px solid #e2e8f0}
/* ── 상세 내용 ── */
.description{font-size:14px;line-height:1.9;color:#334155;word-break:keep-all;white-space:pre-wrap}
/* ── 추가 이미지 ── */
.extra-scroll{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding-bottom:4px;margin-bottom:8px}
.extra-scroll::-webkit-scrollbar{height:3px}
.extra-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:2px}
.extra-img{width:160px;height:120px;object-fit:cover;border-radius:10px;flex-shrink:0;scroll-snap-align:start;background:#e2e8f0}
/* ── 동영상 ── */
.video-wrap{position:relative;width:100%;padding-bottom:56.25%;background:#000;border-radius:12px;overflow:hidden;margin:10px 0}
.video-wrap iframe,.video-wrap video{position:absolute;inset:0;width:100%;height:100%;border:none;object-fit:contain}
/* ── 해시태그 ── */
.hashtag-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.hashtag-badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
/* ── 하단 바 ── */
.bottom-bar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e2e8f0;padding:10px 16px;display:flex;gap:8px;z-index:50;box-shadow:0 -2px 12px rgba(0,0,0,.07)}
.btn{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:11px 6px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:none;transition:opacity .15s;text-decoration:none}
.btn:active{opacity:.75}
.btn-primary{background:#2563eb;color:#fff}
.btn-secondary{background:#f1f5f9;color:#1e293b}
.btn-share{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
/* ── 브랜드 푸터 ── */
.brand-footer{text-align:center;padding:20px 16px 12px;font-size:11px;color:#94a3b8}
/* ── PC ── */
@media(min-width:640px){
  .hero img{max-height:600px}
  .main-title{font-size:24px}
  .content{padding:20px 24px 4px}
  .description{font-size:15px}
  .bottom-bar{max-width:680px;left:50%;transform:translateX(-50%);width:100%}
}
/* ── 콘텐츠 블록 ── */
.block-text{font-size:14px;line-height:1.9;color:#334155;word-break:keep-all;white-space:pre-wrap;margin-bottom:16px}
.block-img{width:100%;border-radius:12px;margin-bottom:16px;object-fit:contain;background:#f8fafc}
/* ── 스크린리더 전용 ── */
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}
/* ── 관리자 SNS 패널 ── */
.admin-toggle-bar{max-width:680px;margin:12px auto 0;padding:0 16px;display:flex;justify-content:flex-end}
.admin-toggle-btn{font-size:11px;font-weight:700;padding:5px 14px;background:#7c3aed;color:#fff;border:none;border-radius:20px;cursor:pointer;letter-spacing:.02em;opacity:.82;transition:opacity .15s}
.admin-toggle-btn:hover{opacity:1}
.admin-sns{max-width:680px;margin:8px auto 100px;border:2px solid #7c3aed;border-radius:16px;background:#faf5ff;overflow:hidden}
.admin-sns-header{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#7c3aed;color:#fff;font-size:13px;font-weight:700}
.admin-edit-btn{font-size:12px;font-weight:600;color:#e9d5ff;text-decoration:none;background:rgba(255,255,255,.15);padding:4px 10px;border-radius:20px}
.admin-edit-btn:hover{background:rgba(255,255,255,.25)}
.admin-sns-section{padding:14px 16px;border-bottom:1px solid #ede9fe}
.admin-sns-section:last-of-type{border-bottom:none}
.admin-label{font-size:11px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:.04em}
.admin-row-between{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.admin-row-gap{display:flex;gap:8px;flex-wrap:wrap}
.admin-caption{font-size:13px;line-height:1.7;color:#1e293b;white-space:pre-wrap;word-break:keep-all;background:#fff;border:1px solid #e9d5ff;border-radius:10px;padding:10px 12px;margin:6px 0}
.admin-hashtags{font-size:12px;color:#6d28d9;margin-bottom:8px;word-break:break-all}
.admin-no-draft{font-size:13px;color:#94a3b8;margin:8px 0;font-style:italic}
.admin-cta-box{background:#f5f3ff;border:1px dashed #c4b5fd;border-radius:10px;padding:8px 12px;margin:8px 0}
.admin-cta-label{font-size:10px;font-weight:700;color:#7c3aed;display:block;margin-bottom:4px}
.admin-cta-text{font-size:11px;font-family:monospace;color:#5b21b6;white-space:pre-wrap;line-height:1.5}
.admin-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:9px 10px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;border:none;transition:opacity .15s;text-decoration:none;min-width:60px}
.admin-btn:active{opacity:.75}
.admin-btn-sm{font-size:11px;padding:4px 10px;border-radius:8px;cursor:pointer;font-weight:600}
.admin-btn-outline{background:#fff;border:1px solid #7c3aed;color:#7c3aed}
.admin-btn-violet{background:#7c3aed;color:#fff}
.admin-btn-teal{background:#0d9488;color:#fff}
.admin-btn-link-copy{background:#f1f5f9;color:#1e293b;border:1px solid #e2e8f0}
.admin-btn-meta{background:#3b5bdb;color:#fff}
.admin-btn-fb{background:#1877f2;color:#fff}
.admin-btn-ig{background:#e1306c;color:#fff}
.admin-guide{font-size:11px;color:#94a3b8;margin-top:8px}
.admin-toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:30px;z-index:200;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.2)}
</style>
</head>
<body>

<!-- 헤더: 뒤로가기 | 로고 | 공유 -->
<header class="header">
  <button class="header-back" onclick="${escHtml(backScript)}" aria-label="뒤로 가기">‹</button>
  <img src="/logo2.png" alt="PLAY강릉" class="header-logo">
  <button class="header-share" onclick="${escHtml(shareScript)}" aria-label="공유하기">📤</button>
</header>

<div class="page-wrap">

  <!-- 대표 이미지 / 카드뉴스 이미지 -->
  ${heroSrc
    ? `<div class="hero"><img src="${escHtml(heroSrc)}" alt="${escHtml(heroAlt)}" loading="eager" fetchpriority="high"${cardExists ? ' class="card-hero"' : ""}></div>`
    : `<div class="hero-text" style="background:linear-gradient(135deg,${catColor}dd,${catColor}99)">
        <span class="category-pill" style="background:rgba(255,255,255,.25)">${escHtml(item.category)}</span>
        <h1 class="main-title" style="color:#fff">${titleEsc}</h1>
        ${summary ? `<p class="hero-text-subtitle">${escHtml(summary)}</p>` : ""}
      </div>`
  }

  <!-- 카테고리 배지 + H1 + 요약 (이미지 있을 때) -->
  ${heroSrc ? `<div class="title-area">
    <span class="category-pill" style="background:${catColor}">${escHtml(item.category)}</span>
    <h1 class="main-title">${titleEsc}</h1>
    ${summary ? `<p class="summary-text">${escHtml(summary)}</p>` : ""}
  </div>` : ""}

  <div class="content">

    <!-- 핵심 정보 카드 -->
    <section aria-labelledby="info-title" style="margin-bottom:20px">
      <h2 id="info-title" class="section-h2">핵심 정보</h2>
      <div class="info-card">
        ${dateStr ? `<div class="info-row">
          <span class="info-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
          <div><span class="info-label">날짜</span>${escHtml(dateStr)}</div>
        </div>` : ""}
        ${item.location ? `<div class="info-row">
          <span class="info-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
          <div><span class="info-label">장소/주소</span>${escHtml(item.location)}</div>
        </div>` : ""}
        <div class="info-row">
          <span class="info-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg></span>
          <div><span class="info-label">카테고리</span>${escHtml(item.category)}</div>
        </div>
        <div class="info-row">
          <span class="info-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg></span>
          <div><span class="info-label">출처</span><span class="source-pill">${escHtml(item.source)}</span></div>
        </div>
        ${hasContact ? `<div class="info-row">
          <span class="info-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81 19.79 19.79 0 01.07 2.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg></span>
          <div><span class="info-label">문의</span>${escHtml(item.contact)}</div>
        </div>` : ""}
      </div>
    </section>

    <!-- H2 상세 내용 -->
    <section aria-labelledby="detail-title" style="margin-bottom:20px">
      <h2 id="detail-title" class="section-h2">상세 내용</h2>
      <p class="description">${descDisplay}</p>
    </section>

    <!-- H2 사진과 영상 (있을 때만) -->
    ${hasMedia ? `<section aria-labelledby="media-title" style="margin-bottom:20px">
      <h2 id="media-title" class="section-h2">사진과 영상</h2>
      ${extraImagesHtml}
      ${item.videoUrl ? renderVideoSection(item.videoUrl) : ""}
    </section>` : ""}

    <!-- 추가 콘텐츠 블록 -->
    ${contentBlocksHtml ? `<section aria-label="추가 콘텐츠" style="margin-bottom:20px">${contentBlocksHtml}</section>` : ""}

    <!-- 해시태그 -->
    ${hashtagsHtml}

  </div>

  <!-- 브랜드 푸터 -->
  <div class="brand-footer">
    강릉의 모든 것 · PLAY강릉<br>
    <a href="${SITE_URL}" style="color:#2563eb">playgangneung.com</a>
  </div>
</div>

<!-- 고정 하단 버튼: 원본 보기 | 공유하기 | 홈 -->
<div class="bottom-bar">
  ${hasLink ? `<a href="${escHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">🔗 원본 보기</a>` : ""}
  <button class="btn btn-share" onclick="${escHtml(shareScript)}">📤 공유하기</button>
  <a href="/" class="btn btn-secondary">🏠 홈</a>
</div>

${isAdmin ? renderAdminSnsPanel(item, contentUrl) : ""}
${renderAdminPanelJs(item)}

</body>
</html>`;
}

// ─── 라우터 ──────────────────────────────────────────────────────────────────

// 보호 엔드포인트: 어드민 인증(세션 쿠키 또는 Bearer 토큰) 확인 후
// 관리자 패널 HTML + JS 반환. 일반 방문자는 401 응답.
router.get("/:id/admin-panel", requireAdmin, async (req, res) => {
  const id = req.params["id"] as string;
  const contentUrl = `${SITE_URL}/content/${id}`;
  const item = await findContent(id);
  if (!item) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(renderAdminPanelPayload(item, contentUrl));
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const contentUrl = `${SITE_URL}/content/${id}`;

  const [item, cardExists] = await Promise.all([findContent(id), hasCardImage(id)]);

  if (!item) {
    res.status(404).send(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>찾을 수 없음 | PLAY강릉</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;color:#1e293b;text-align:center;padding:20px}h1{font-size:22px;margin-bottom:8px}p{color:#64748b;font-size:14px}a{color:#2563eb;font-weight:600}</style></head><body><div><h1>😔 콘텐츠를 찾을 수 없어요</h1><p>삭제되었거나 잘못된 링크입니다.</p><br><a href="${SITE_URL}">PLAY강릉 홈으로</a></div></body></html>`);
    return;
  }

  const ogImageOverride = cardExists ? `${SITE_URL}/api/cards/${id}.png` : null;
  const isAdmin = req.session?.isAdmin === true;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(renderHtml(item, contentUrl, cardExists, ogImageOverride, isAdmin));
});

export default router;
