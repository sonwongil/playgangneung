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
  sourceType: SourceType;
  status: EventStatus;
  socialDraft: SocialDraft | null;
  cardImageUrl: string | null;
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
      sourceType: (e.sourceType as SourceType) ?? "html",
      status: (e.status as EventStatus) ?? "draft",
      socialDraft: e.socialDraft ?? null,
      cardImageUrl: e.cardImageUrl ?? null,
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

function dupKey(e: CrawledEvent): string {
  return `${e.title.trim().slice(0, 40)}|${e.source}|${e.startDate || e.date}`;
}

export async function appendEvents(
  newEvents: CrawledEvent[],
): Promise<{ added: number; total: number }> {
  const existing = await readEvents();
  const existingIds = new Set(existing.map((e) => e.id));
  const existingKeys = new Set(existing.map(dupKey));
  const fresh = newEvents.filter(
    (e) => !existingIds.has(e.id) && !existingKeys.has(dupKey(e)),
  );
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

export async function saveEventCard(
  id: string,
  cardImageUrl: string,
): Promise<boolean> {
  const events = await readEvents();
  const idx = events.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  events[idx] = { ...events[idx], cardImageUrl };
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
