import type { ScheduleStatus } from "./dateParser.js";
import { gcsReadJson, gcsWriteJson } from "./gcsJson.js";

const EVENTS_FILE = "data/events.json";

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

export async function readEvents(): Promise<CrawledEvent[]> {
  const raw = await gcsReadJson<Partial<CrawledEvent>[]>(EVENTS_FILE, []);
  return raw.map((e) => ({
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
}

export async function saveEvents(events: CrawledEvent[]): Promise<void> {
  await gcsWriteJson(EVENTS_FILE, events);
}

function normalizeTitle(s: string): string {
  return s
    .replace(/[＜＞《》「」『』【】<>()（）\[\]]/g, " ")
    .replace(/[_\-·•\.]/g, " ")
    .replace(/\s+/g, "")
    .toLowerCase()
    .slice(0, 60);
}

function dupKeys(e: CrawledEvent): string[] {
  const keys = new Set<string>();
  keys.add(normalizeTitle(e.title));
  const bracketRe = /[＜＜《「『【<(（\[](.*?)[＞＞》」』】>)）\]]/g;
  let m: RegExpExecArray | null;
  while ((m = bracketRe.exec(e.title)) !== null) {
    const inner = normalizeTitle(m[1]);
    if (inner.length >= 6) keys.add(inner);
  }
  return [...keys];
}

function keysOverlap(aKeys: string[], bKeys: string[]): boolean {
  for (const a of aKeys) {
    for (const b of bKeys) {
      if (a === b) return true;
      const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
      if (shorter.length >= 6 && longer.includes(shorter)) return true;
    }
  }
  return false;
}

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
      const existing = kept[dupIdx];
      if (contentScore(ev) > contentScore(existing)) {
        kept[dupIdx] = mergeRicher(existing, ev);
        keptKeys[dupIdx] = dupKeys(kept[dupIdx]);
      }
    }
  }

  await saveEvents(kept);
  return { before, after: kept.length, removed: before - kept.length };
}

function contentScore(e: CrawledEvent): number {
  let score = 0;
  score += Math.min(e.description.length, 400);
  if (e.thumbnail) score += 150;
  if (e.contact) score += 60;
  if (e.startDate) score += 30;
  if (e.endDate) score += 20;
  if (e.location && e.location !== "강릉") score += 25;
  return score;
}

function mergeRicher(old: CrawledEvent, newer: CrawledEvent): CrawledEvent {
  return {
    ...newer,
    id: old.id,
    status: old.status,
    socialDraft: old.socialDraft,
    crawledAt: old.crawledAt,
  };
}

function isWithinCrawlWindow(e: CrawledEvent): boolean {
  if (!e.startDate) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = e.endDate ? new Date(e.endDate) : new Date(e.startDate);
  if (end < today) return false;
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 10);
  return new Date(e.startDate) <= cutoff;
}

export async function appendEvents(
  newEvents: CrawledEvent[],
): Promise<{ added: number; updated: number; total: number }> {
  const existing = await readEvents();
  const idxById = new Map<string, number>(existing.map((e, i) => [e.id, i]));
  const existingKeysList = existing.map(dupKeys);
  let added = 0;
  let updated = 0;

  for (const newEvent of newEvents) {
    if (!isWithinCrawlWindow(newEvent)) continue;
    const newKeys = dupKeys(newEvent);

    if (idxById.has(newEvent.id)) {
      const idx = idxById.get(newEvent.id)!;
      if (contentScore(newEvent) > contentScore(existing[idx])) {
        existing[idx] = mergeRicher(existing[idx], newEvent);
        existingKeysList[idx] = dupKeys(existing[idx]);
        updated++;
      }
      continue;
    }

    const dupIdx = existingKeysList.findIndex((exK) => keysOverlap(newKeys, exK));
    if (dupIdx !== -1) {
      if (contentScore(newEvent) > contentScore(existing[dupIdx])) {
        existing[dupIdx] = mergeRicher(existing[dupIdx], newEvent);
        existingKeysList[dupIdx] = dupKeys(existing[dupIdx]);
        updated++;
      }
      continue;
    }

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
