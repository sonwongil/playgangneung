import type { CrawledEvent, SocialDraft } from "./storage.js";

// ─── 템플릿 풀 ────────────────────────────────────────────────────────────────

const TITLE_PREFIXES = [
  "✨", "🌊", "🏔️", "🌿", "🎉", "📍", "🌸", "🎶", "🍃", "🌅",
];

const VISIT_PHRASES = [
  "강릉에서만 느낄 수 있는 특별한 경험, 놓치지 마세요!",
  "강릉으로 떠나는 특별한 하루를 계획해 보세요.",
  "강릉의 아름다운 자연과 문화를 직접 만나보세요.",
  "올해 강릉에서 가장 기대되는 행사입니다.",
  "강릉 여행의 완성! 이 행사와 함께하세요.",
  "강릉을 더욱 특별하게 만들어 줄 행사를 소개합니다.",
  "강릉의 매력을 온몸으로 느낄 수 있는 기회입니다.",
  "강릉 여행 계획 중이라면 꼭 참고하세요!",
];

const LOCATION_PHRASES = [
  "📍 강원특별자치도 강릉시",
  "📍 강릉에서 만나요",
  "📍 강릉 현지에서 직접 즐기는",
  "📍 아름다운 강릉에서",
];

const BASE_HASHTAGS = [
  "강릉", "강릉여행", "강릉관광", "강원도", "강원도여행",
  "PLAY강릉", "강릉핫플", "강릉여행추천", "강릉나들이",
  "강릉데이트", "국내여행", "국내여행추천", "여행스타그램",
  "강릉축제", "강릉행사",
];

const CATEGORY_HASHTAGS: Record<string, string[]> = {
  커피:   ["강릉커피", "강릉카페", "커피도시강릉", "바리스타"],
  축제:   ["강릉축제", "강릉페스티벌", "축제"],
  단오:   ["강릉단오제", "단오제", "유네스코무형문화유산"],
  음악:   ["강릉음악", "뮤직페스티벌", "공연"],
  해변:   ["강릉해변", "경포해변", "강문해변", "해수욕"],
  오죽헌: ["오죽헌", "율곡이이", "신사임당", "강릉문화재"],
  바우길: ["바우길", "트레킹", "강릉둘레길", "걷기여행"],
  시장:   ["강릉중앙시장", "강릉시장", "강릉맛집"],
  공연:   ["강릉공연", "문화행사", "공연관람"],
  전시:   ["강릉전시", "미술전시", "전시회"],
  사진:   ["강릉포토", "포토존", "사진여행"],
};

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr.replace(/\./g, "-"));
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function detectCategories(event: CrawledEvent): string[] {
  const text = (event.title + " " + event.description).toLowerCase();
  return Object.entries(CATEGORY_HASHTAGS)
    .filter(([keyword]) => text.includes(keyword))
    .map(([, tags]) => pick(tags));
}

// ─── 초안 생성 ───────────────────────────────────────────────────────────────

export function generateSocialDraft(event: CrawledEvent): SocialDraft {
  if (event.status !== "approved") {
    throw new Error("승인(approved) 상태의 이벤트만 SNS 초안을 생성할 수 있습니다.");
  }

  const emoji = pick(TITLE_PREFIXES);
  const title = `${emoji} ${event.title}`;

  // 날짜 표현
  const dateStr = event.date ? `🗓️ ${formatDate(event.date)}\n` : "";

  // 본문 3~5줄 구성
  const visitPhrase = pick(VISIT_PHRASES);
  const locationPhrase = pick(LOCATION_PHRASES);

  let caption = "";
  caption += `${locationPhrase}\n`;
  if (dateStr) caption += dateStr;
  caption += `\n`;

  if (event.description && event.description.length > 10) {
    caption += `${event.description.slice(0, 120)}\n\n`;
  } else {
    caption += `강릉의 특색 있는 문화와 자연을 배경으로 열리는 이번 행사를 소개합니다.\n\n`;
  }

  caption += `${visitPhrase}`;

  // 해시태그 5~8개
  const catTags = detectCategories(event);
  const basePick = pickN(BASE_HASHTAGS, Math.max(0, 6 - catTags.length));
  const allTags = [...new Set([...catTags, ...basePick])].slice(0, 8);

  return {
    title,
    caption: caption.trim(),
    hashtags: allTags,
    createdAt: new Date().toISOString(),
  };
}
