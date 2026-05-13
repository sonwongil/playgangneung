import { db, eventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import type { ScheduleStatus } from "./dateParser.js";

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

function rowToEvent(row: typeof eventsTable.$inferSelect): CrawledEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.date,
    startDate: row.startDate,
    endDate: row.endDate,
    scheduleStatus: row.scheduleStatus as ScheduleStatus,
    location: row.location,
    category: row.category,
    thumbnail: row.thumbnail ?? null,
    videoUrl: row.videoUrl ?? null,
    link: row.link,
    source: row.source,
    contact: row.contact,
    sourceType: row.sourceType as SourceType,
    status: row.status as EventStatus,
    socialDraft: (row.socialDraft as SocialDraft) ?? null,
    crawledAt: row.crawledAt,
  };
}

export async function readEvents(): Promise<CrawledEvent[]> {
  const rows = await db.select().from(eventsTable);
  return rows.map(rowToEvent);
}

export async function saveEvents(events: CrawledEvent[]): Promise<void> {
  if (events.length === 0) return;
  await db
    .insert(eventsTable)
    .values(
      events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: e.date,
        startDate: e.startDate,
        endDate: e.endDate,
        scheduleStatus: e.scheduleStatus,
        location: e.location,
        category: e.category,
        thumbnail: e.thumbnail,
        videoUrl: e.videoUrl,
        link: e.link,
        source: e.source,
        contact: e.contact,
        sourceType: e.sourceType,
        status: e.status,
        socialDraft: e.socialDraft as any,
        crawledAt: e.crawledAt,
      })),
    )
    .onConflictDoUpdate({
      target: eventsTable.id,
      set: {
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        date: sql`excluded.date`,
        startDate: sql`excluded.start_date`,
        endDate: sql`excluded.end_date`,
        scheduleStatus: sql`excluded.schedule_status`,
        location: sql`excluded.location`,
        category: sql`excluded.category`,
        thumbnail: sql`excluded.thumbnail`,
        videoUrl: sql`excluded.video_url`,
        link: sql`excluded.link`,
        source: sql`excluded.source`,
        contact: sql`excluded.contact`,
        sourceType: sql`excluded.source_type`,
        status: sql`excluded.status`,
        socialDraft: sql`excluded.social_draft`,
        crawledAt: sql`excluded.crawled_at`,
      },
    });
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

  await db.delete(eventsTable);
  if (kept.length > 0) await saveEvents(kept);
  return { before, after: kept.length, removed: before - kept.length };
}

export async function appendEvents(
  newEvents: CrawledEvent[],
): Promise<{ added: number; updated: number; total: number }> {
  const existing = await readEvents();
  const idxById = new Map<string, number>(existing.map((e, i) => [e.id, i]));
  const existingKeysList = existing.map(dupKeys);
  const toUpsert: CrawledEvent[] = [];
  let added = 0;
  let updated = 0;

  for (const newEvent of newEvents) {
    const isManual = newEvent.sourceType === "manual";
    if (!isManual && !isWithinCrawlWindow(newEvent)) continue;
    const newKeys = dupKeys(newEvent);

    if (idxById.has(newEvent.id)) {
      const idx = idxById.get(newEvent.id)!;
      if (isManual || contentScore(newEvent) > contentScore(existing[idx])) {
        const merged = mergeRicher(existing[idx], newEvent);
        toUpsert.push(merged);
        existingKeysList[idx] = dupKeys(merged);
        updated++;
      }
      continue;
    }

    const dupIdx = existingKeysList.findIndex((exK) => keysOverlap(newKeys, exK));
    if (dupIdx !== -1) {
      if (isManual || contentScore(newEvent) > contentScore(existing[dupIdx])) {
        const merged = mergeRicher(existing[dupIdx], newEvent);
        toUpsert.push(merged);
        existingKeysList[dupIdx] = dupKeys(merged);
        updated++;
      }
      continue;
    }

    toUpsert.push(newEvent);
    added++;
  }

  if (toUpsert.length > 0) await saveEvents(toUpsert);
  const total = await db.$count(eventsTable);
  return { added, updated, total };
}

export async function updateEventStatus(id: string, status: EventStatus): Promise<boolean> {
  const result = await db
    .update(eventsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(eventsTable.id, id));
  return (result.rowCount ?? 0) > 0;
}

export async function saveEventDraft(id: string, socialDraft: SocialDraft): Promise<boolean> {
  const result = await db
    .update(eventsTable)
    .set({ socialDraft: socialDraft as any, updatedAt: new Date() })
    .where(eq(eventsTable.id, id));
  return (result.rowCount ?? 0) > 0;
}

export async function updateEvent(id: string, patch: Partial<CrawledEvent>): Promise<boolean> {
  const result = await db
    .update(eventsTable)
    .set({ ...(patch as any), updatedAt: new Date() })
    .where(eq(eventsTable.id, id));
  return (result.rowCount ?? 0) > 0;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const result = await db.delete(eventsTable).where(eq(eventsTable.id, id));
  return (result.rowCount ?? 0) > 0;
}
