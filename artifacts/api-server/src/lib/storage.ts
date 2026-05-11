import fs from "fs/promises";
import path from "path";
import type { ScheduleStatus } from "./dateParser.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");

export type SourceType = "rss" | "html" | "manual";
export type EventStatus = "draft" | "approved" | "rejected" | "published";

export interface SocialDraft {
  title: string;
  caption: string;
  hashtags: string[];
  createdAt: string;
}

export interface CrawledEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  startDate: string;
  endDate: string;
  scheduleStatus: ScheduleStatus;
  location: string;
  category: string;
  thumbnail: string | null;
  link: string;
  source: string;
  contact: string;
  sourceType: SourceType;
  status: EventStatus;
  socialDraft: SocialDraft | null;
  crawledAt: string;
}

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

export async function readEvents(): Promise<CrawledEvent[]> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(EVENTS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<CrawledEvent>[];
    return parsed.map((e) => ({
      id: e.id ?? "",
      title: e.title ?? "",
      description: e.description ?? "",
      date: e.date ?? e.startDate ?? "",
      startDate: e.startDate ?? e.date ?? "",
      endDate: e.endDate ?? "",
      scheduleStatus: (e.scheduleStatus as ScheduleStatus) ?? "upcoming",
      location: e.location ?? "",
      category: e.category ?? "지역소식",
      thumbnail: e.thumbnail ?? null,
      link: e.link ?? "",
      source: e.source ?? "",
      contact: (e as any).contact ?? "",
      sourceType: (e.sourceType as SourceType) ?? "html",
      status: (e.status as EventStatus) ?? "draft",
      socialDraft: e.socialDraft ?? null,
      crawledAt: e.crawledAt ?? new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function saveEvents(events: CrawledEvent[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
}

function normalizeTitle(s: string): string {
  return s
    .replace(/[＜＞《》「」『』【】<>()（）\[\]]/g, " ")
    .replace(/[_\-·•\.]/g, " ")
    .replace(/\s+/g, "")
    .toLowerCase()
    .slice(0, 60);
}

/** 한 이벤트에서 중복 감지용 키를 여러 개 추출 (괄호 안 내용도 별도 키) */
function dupKeys(e: CrawledEvent): string[] {
  const keys = new Set<string>();
  keys.add(normalizeTitle(e.title));

  // 괄호·꺾쇠 안 내용을 별도 키로 추가
  const bracketRe = /[＜＜《「『【<(（\[](.*?)[＞＞》」』】>)）\]]/g;
  let m: RegExpExecArray | null;
  while ((m = bracketRe.exec(e.title)) !== null) {
    const inner = normalizeTitle(m[1]);
    if (inner.length >= 6) keys.add(inner);
  }
  return [...keys];
}

/** 두 정규화 키가 "같은 행사"로 볼 수 있는지 판단 (완전일치 or 한쪽이 다른 쪽의 접두어) */
function keysOverlap(aKeys: string[], bKeys: string[]): boolean {
  for (const a of aKeys) {
    for (const b of bKeys) {
      if (a === b) return true;
      // 짧은 쪽이 긴 쪽의 시작 부분과 같으면 동일 행사 (e.g. "발렌티나리사이틀" vs "발렌티나리사이틀쇼팽")
      const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
      if (shorter.length >= 12 && longer.startsWith(shorter)) return true;
    }
  }
  return false;
}

/**
 * 오늘 기준 앞으로 10일 이내 시작하는 항목만 신규 수집.
 * startDate가 없는 공지/정보는 날짜 무관하게 항상 포함.
 */
function isWithinCrawlWindow(e: CrawledEvent): boolean {
  if (!e.startDate) return true; // 날짜 없는 공지·정보 항상 포함

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 이미 종료된 행사 제외 (endDate 있으면 endDate 기준, 없으면 startDate 기준)
  const end = e.endDate ? new Date(e.endDate) : new Date(e.startDate);
  if (end < today) return false;

  // 앞으로 10일 초과 미래 행사 제외
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 10);
  return new Date(e.startDate) <= cutoff;
}

export async function appendEvents(
  newEvents: CrawledEvent[],
): Promise<{ added: number; total: number }> {
  const existing = await readEvents();
  const existingIds = new Set(existing.map((e) => e.id));
  const existingKeysList = existing.map(dupKeys);
  const fresh = newEvents.filter((e) => {
    if (!isWithinCrawlWindow(e)) return false; // 10일 초과 항목 제외
    if (existingIds.has(e.id)) return false;
    const newK = dupKeys(e);
    return !existingKeysList.some((exK) => keysOverlap(newK, exK));
  });
  const merged = [...existing, ...fresh];
  await saveEvents(merged);
  return { added: fresh.length, total: merged.length };
}

export async function updateEventStatus(
  id: string,
  status: EventStatus,
): Promise<boolean> {
  const events = await readEvents();
  const idx = events.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  events[idx] = { ...events[idx], status };
  await saveEvents(events);
  return true;
}

export async function saveEventDraft(
  id: string,
  socialDraft: SocialDraft,
): Promise<boolean> {
  const events = await readEvents();
  const idx = events.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  events[idx] = { ...events[idx], socialDraft };
  await saveEvents(events);
  return true;
}

export async function updateEvent(
  id: string,
  patch: Partial<CrawledEvent>,
): Promise<boolean> {
  const events = await readEvents();
  const idx = events.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  events[idx] = { ...events[idx], ...patch };
  await saveEvents(events);
  return true;
}
