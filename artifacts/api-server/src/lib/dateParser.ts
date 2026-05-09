export type ScheduleStatus =
  | "today"
  | "tomorrow"
  | "ongoing"
  | "upcoming"
  | "ended"
  | "dateUnknown";

export interface ParsedDates {
  startDate: string;
  endDate: string;
  scheduleStatus: ScheduleStatus;
}

function toIso(raw: string): string {
  return raw.replace(/\./g, "-").replace(/\//g, "-").trim();
}

function kstDateStr(offsetDays = 0): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);
  return kst.toISOString().slice(0, 10);
}

function todayStr(): string {
  return kstDateStr(0);
}

function tomorrowStr(): string {
  return kstDateStr(1);
}

function calcStatus(start: string, end: string): ScheduleStatus {
  const today = todayStr();
  const tomorrow = tomorrowStr();
  if (!start) return "dateUnknown";
  if (start === today && (!end || end === today)) return "today";
  if (start === tomorrow && (!end || end === tomorrow)) return "tomorrow";
  if (start > tomorrow) return "upcoming";
  const effectiveEnd = end || start;
  if (effectiveEnd < today) return "ended";
  return "ongoing";
}

export function parseDates(raw: string): ParsedDates {
  if (!raw || raw.trim() === "") {
    return { startDate: "", endDate: "", scheduleStatus: "dateUnknown" };
  }

  // Range: "2026.05.01 ~ 2026.05.03" or "2026-05-01~2026-05-03" or "2026.05.01-2026.05.03"
  const rangeMatch = raw.match(
    /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s*[~\-–—]\s*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/,
  );
  if (rangeMatch) {
    const start = toIso(rangeMatch[1]).replace(/(\d{4})-(\d{1})-/, "$1-0$2-").replace(/-(\d{1})$/, "-0$1");
    const end   = toIso(rangeMatch[2]).replace(/(\d{4})-(\d{1})-/, "$1-0$2-").replace(/-(\d{1})$/, "-0$1");
    const startPad = padDate(start);
    const endPad   = padDate(end);
    return { startDate: startPad, endDate: endPad, scheduleStatus: calcStatus(startPad, endPad) };
  }

  // Short range: "2026.05.01 ~ 05.03" (year inherited)
  const shortRangeMatch = raw.match(
    /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s*[~\-–—]\s*(\d{1,2})[.\-/](\d{1,2})/,
  );
  if (shortRangeMatch) {
    const [, y, m1, d1, m2, d2] = shortRangeMatch;
    const start = `${y}-${m1.padStart(2,"0")}-${d1.padStart(2,"0")}`;
    const end   = `${y}-${m2.padStart(2,"0")}-${d2.padStart(2,"0")}`;
    return { startDate: start, endDate: end, scheduleStatus: calcStatus(start, end) };
  }

  // Single date
  const singleMatch = raw.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (singleMatch) {
    const [, y, m, d] = singleMatch;
    const start = `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
    return { startDate: start, endDate: "", scheduleStatus: calcStatus(start, "") };
  }

  return { startDate: "", endDate: "", scheduleStatus: "dateUnknown" };
}

function padDate(s: string): string {
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return s;
  return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
}

export function detectCategory(title: string, description: string): string {
  const text = (title + " " + description).toLowerCase();
  if (/커피|카페|맛집|음식|식당|순두부|먹거리|맛|음료|요리/.test(text)) return "맛집";
  if (/축제|행사|이벤트|공연|전시|콘서트|뮤지컬|연극|체험|박람회|마켓|장터/.test(text)) return "행사";
  if (/핫플|명소|관광|여행|해변|해수욕|등산|트레킹|바우길|오죽헌|경포/.test(text)) return "핫플";
  if (/뉴스|소식|공지|발표|선정|출범|위원회|현황|결과|지원|모집|신청/.test(text)) return "지역소식";
  return "행사";
}
