import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");

export type SourceType = "rss" | "html" | "manual";
export type EventStatus = "draft" | "approved" | "rejected";

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
  link: string;
  source: string;
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
    const parsed = JSON.parse(raw) as CrawledEvent[];
    return parsed.map((e) => ({
      ...e,
      sourceType: (e.sourceType as SourceType) ?? "html",
      status: (e.status as EventStatus) ?? "draft",
      socialDraft: e.socialDraft ?? null,
    }));
  } catch {
    return [];
  }
}

export async function saveEvents(events: CrawledEvent[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
}

export async function appendEvents(
  newEvents: CrawledEvent[],
): Promise<{ added: number; total: number }> {
  const existing = await readEvents();
  const existingIds = new Set(existing.map((e) => e.id));
  const fresh = newEvents.filter((e) => !existingIds.has(e.id));
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
