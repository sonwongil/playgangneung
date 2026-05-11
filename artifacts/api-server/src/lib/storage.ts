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
  videoUrl: string | null;
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
      videoUrl: (e as any).videoUrl ?? null,
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

/** 두 정규화 키가 "같은 행사"로 볼 수 있는지 판단 */
function keysOverlap(aKeys: string[], bKeys: string[]): boolean {
  for (const a of aKeys) {
    for (const b of bKeys) {
      if (a === b) return true;
      // 짧은 쪽이 긴 쪽 안에 포함되면 동일 행사로 판단
      // (접두어 방식에서 부분문자열 방식으로 변경 — 다른 소스 간 제목 차이 흡수)
      const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
      if (shorter.length >= 6 && longer.includes(shorter)) return true;
    }
  }
  return false;
}

/**
 * 기존 저장 이벤트의 중복을 소급 정리.
 * 제목 키가 겹치는 항목을 하나로 합치되, 가장 충실한 콘텐츠를 유지하고
 * 편집 상태(status, socialDraft)는 가장 앞서 처리된 항목(먼저 승인된 것)을 우선합니다.
 */
export async function deduplicateExisting(): Promise<{ before: number; after: number; removed: number }> {
  const events = await readEvents();
  const before = events.length;

  const kept: CrawledEvent[] = [];
  const keptKeys: string[][] = [];

  for (const ev of events) {
    const evKeys = dupKeys(ev);
    const dupIdx = keptKeys.findIndex((k) => keysOverlap(evKeys, k));
    if (dupIdx === -1) {
      kept.push(ev);
      keptKeys.push(evKeys);
    } else {
      // 이미 보관된 항목과 비교해 더 충실한 쪽의 콘텐츠 채택
      const existing = kept[dupIdx];
      if (contentScore(ev) > contentScore(existing)) {
        kept[dupIdx] = mergeRicher(existing, ev);
        keptKeys[dupIdx] = dupKeys(kept[dupIdx]);
      }
      // 편집 상태(status, socialDraft)는 mergeRicher 내에서 기존(existing) 것을 유지하므로 별도 처리 불필요
    }
  }

  await saveEvents(kept);
  return { before, after: kept.length, removed: before - kept.length };
}

/** 콘텐츠 충실도 점수 — 높을수록 정보가 풍부한 항목 */
function contentScore(e: CrawledEvent): number {
  let score = 0;
  score += Math.min(e.description.length, 400); // 설명 길이 (최대 400점)
  if (e.thumbnail) score += 150;                // 썸네일 이미지 있음
  if (e.contact) score += 60;                   // 연락처 있음
  if (e.startDate) score += 30;                 // 시작일 있음
  if (e.endDate) score += 20;                   // 종료일 있음
  if (e.location && e.location !== "강릉") score += 25; // 구체적인 장소 있음
  return score;
}

/**
 * 더 충실한 새 항목의 콘텐츠를 기존 항목에 병합.
 * 편집 상태(status, socialDraft), ID, 최초 수집 시각은 기존 항목 값을 유지.
 */
function mergeRicher(old: CrawledEvent, newer: CrawledEvent): CrawledEvent {
  return {
    ...newer,
    id: old.id,                   // ID 유지 (카드이미지 경로 등 연관 데이터)
    status: old.status,           // 편집 상태 유지 (draft/approved/rejected/published)
    socialDraft: old.socialDraft, // SNS 초안 유지
    crawledAt: old.crawledAt,     // 최초 수집 시각 유지
  };
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
): Promise<{ added: number; updated: number; total: number }> {
  const existing = await readEvents();

  // 빠른 검색을 위한 인덱스
  const idxById = new Map<string, number>(existing.map((e, i) => [e.id, i]));
  const existingKeysList = existing.map(dupKeys);

  let added = 0;
  let updated = 0;

  for (const newEvent of newEvents) {
    if (!isWithinCrawlWindow(newEvent)) continue;

    const newKeys = dupKeys(newEvent);

    // ① ID 완전 일치 — 점수 비교 후 더 충실하면 콘텐츠 업데이트
    if (idxById.has(newEvent.id)) {
      const idx = idxById.get(newEvent.id)!;
      if (contentScore(newEvent) > contentScore(existing[idx])) {
        existing[idx] = mergeRicher(existing[idx], newEvent);
        existingKeysList[idx] = dupKeys(existing[idx]);
        updated++;
      }
      continue;
    }

    // ② 제목 키 중복 — 점수 비교 후 더 충실하면 콘텐츠 업데이트
    const dupIdx = existingKeysList.findIndex((exK) => keysOverlap(newKeys, exK));
    if (dupIdx !== -1) {
      if (contentScore(newEvent) > contentScore(existing[dupIdx])) {
        existing[dupIdx] = mergeRicher(existing[dupIdx], newEvent);
        existingKeysList[dupIdx] = dupKeys(existing[dupIdx]);
        updated++;
      }
      continue;
    }

    // ③ 완전 신규 — 추가
    idxById.set(newEvent.id, existing.length);
    existingKeysList.push(newKeys);
    existing.push(newEvent);
    added++;
  }

  await saveEvents(existing);
  return { added, updated, total: existing.length };
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
