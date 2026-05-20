import type { CrawledEvent, SocialDraft } from "./storage.js";

// ─── 카테고리별 해시태그 ──────────────────────────────────────────────────────

const BASE_HASHTAGS_BY_CATEGORY: Record<string, string[]> = {
  행사: ["PLAY강릉", "강릉", "강릉행사", "강릉축제", "강릉여행", "강원도", "국내여행", "강릉나들이", "강릉핫플"],
  맛집: ["PLAY강릉", "강릉맛집", "강릉", "강릉여행", "강릉카페", "강원도맛집", "강릉핫플", "맛스타그램"],
  핫플: ["PLAY강릉", "강릉핫플", "강릉", "강릉여행", "강릉명소", "강원도여행", "국내여행", "여행스타그램"],
  지역소식: ["PLAY강릉", "강릉", "강릉소식", "강릉시", "강원도", "강릉행정", "강릉정보"],
};

const DEFAULT_HASHTAGS = ["PLAY강릉", "강릉", "강릉소식", "강원도", "강릉여행", "국내여행"];

// ─── 카테고리별 이모지 ────────────────────────────────────────────────────────

const EMOJI_BY_CATEGORY: Record<string, string[]> = {
  행사: ["🎉", "🎶", "🌸", "✨", "🎊", "🎭", "🏮"],
  맛집: ["🍽️", "🍜", "☕", "🥘", "🍣", "🌊"],
  핫플: ["📍", "🌅", "🏖️", "🌿", "📸", "✨"],
  지역소식: ["📢", "📋", "ℹ️", "📣", "🏛️"],
};

const DEFAULT_EMOJI = ["📍", "✨", "🌊", "🏔️", "🌿"];

// ─── 유틸 ────────────────────────────────────────────────────────────────────

/** HTML 태그와 엔티티를 plain text로 변환 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr.replace(/\./g, "-"));
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function getCategory(event: CrawledEvent): string {
  const cat = event.category ?? "";
  if (cat.includes("행사") || cat.includes("축제")) return "행사";
  if (cat.includes("맛집")) return "맛집";
  if (cat.includes("핫플")) return "핫플";
  if (cat.includes("지역소식")) return "지역소식";
  return "";
}

// ─── 초안 생성 ───────────────────────────────────────────────────────────────

const SITE_URL = process.env["SITE_URL"] ?? "https://play-gangneung-dashboard.replit.app";

export function generateSocialDraft(event: CrawledEvent): SocialDraft {
  const category = getCategory(event);

  // 이모지 + 제목
  const emojiPool = EMOJI_BY_CATEGORY[category] ?? DEFAULT_EMOJI;
  const emoji = pick(emojiPool);
  const titleLine = `${emoji} ${event.title}`;

  // 날짜
  const dateStr = event.date ? `🗓️ ${formatDate(event.date)}` : "";

  // 위치
  const locationLine = event.location
    ? `📍 ${event.location}`
    : "📍 강릉시";

  // 설명 — HTML 태그/엔티티 제거 후 최대 200자, 잘릴 경우 문장 경계에서 자름
  let descBlock = "";
  if (event.description && event.description.trim().length > 10) {
    let desc = stripHtml(event.description.trim());
    if (desc.length > 200) {
      const cut = desc.lastIndexOf(".", 200);
      desc = cut > 50 ? desc.slice(0, cut + 1) : desc.slice(0, 200) + "…";
    }
    descBlock = desc;
  }

  // PLAY강릉 콘텐츠 링크 (Facebook OG 미리보기 카드 생성용)
  const contentLink = `${SITE_URL}/content/${event.id}`;

  // 본문 조합
  const parts: string[] = [titleLine];
  if (dateStr) parts.push(dateStr);
  parts.push(locationLine);
  if (descBlock) {
    parts.push("");
    parts.push(descBlock);
  }
  parts.push("");
  parts.push(`🔗 자세히 보기 → ${contentLink}`);

  const caption = parts.join("\n").trim();

  // 해시태그 (카테고리별 6~8개)
  const hashtagPool = BASE_HASHTAGS_BY_CATEGORY[category] ?? DEFAULT_HASHTAGS;
  const hashtags = pickN(hashtagPool, Math.min(8, hashtagPool.length));

  return {
    title: event.title,
    caption,
    hashtags,
    createdAt: new Date().toISOString(),
  };
}
