import type { CrawledEvent, SocialDraft } from "./storage.js";

// ─── 카테고리별 마무리 문구 ────────────────────────────────────────────────────

const CLOSING_BY_CATEGORY: Record<string, string[]> = {
  행사: [
    "강릉에서 직접 만나보세요! 📅",
    "이번 행사를 놓치지 마세요!",
    "강릉의 특별한 행사가 여러분을 기다립니다.",
    "더 많은 정보는 아래 링크에서 확인하세요.",
  ],
  맛집: [
    "강릉 여행 중 꼭 들러보세요! 🍽️",
    "강릉 맛집 투어, 이곳도 리스트에 추가하세요.",
    "강릉에서만 즐길 수 있는 특별한 맛입니다.",
  ],
  핫플: [
    "강릉 여행 필수 코스로 추천합니다! 📍",
    "사진 한 장으로 강릉의 매력을 담아보세요.",
    "강릉 여행 중 꼭 방문해 보세요!",
  ],
  지역소식: [
    "해당 내용을 꼼꼼히 확인하세요.",
    "관련 문의는 담당 부서로 연락해 주세요.",
    "자세한 내용은 아래 링크에서 확인하세요.",
    "신청 기간을 놓치지 마세요!",
  ],
};

const DEFAULT_CLOSING = [
  "더 자세한 내용은 아래 링크에서 확인하세요.",
  "관련 문의는 해당 기관으로 연락해 주세요.",
  "자세한 사항을 꼭 확인해 보세요!",
];

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

export function generateSocialDraft(event: CrawledEvent): SocialDraft {
  if (event.status !== "approved") {
    throw new Error("승인(approved) 상태의 이벤트만 SNS 초안을 생성할 수 있습니다.");
  }

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

  // 설명 — 최대 250자, 잘릴 경우 문장 경계에서 자름
  let descBlock = "";
  if (event.description && event.description.trim().length > 10) {
    let desc = event.description.trim();
    if (desc.length > 250) {
      const cut = desc.lastIndexOf(".", 250);
      desc = cut > 50 ? desc.slice(0, cut + 1) : desc.slice(0, 250) + "…";
    }
    descBlock = desc;
  }

  // 마무리 문구 (카테고리 맞춤)
  const closingPool = CLOSING_BY_CATEGORY[category] ?? DEFAULT_CLOSING;
  const closing = pick(closingPool);

  // 본문 조합
  const parts: string[] = [titleLine];
  if (dateStr) parts.push(dateStr);
  parts.push(locationLine);
  if (descBlock) {
    parts.push("");
    parts.push(descBlock);
  }
  parts.push("");
  parts.push(closing);

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
