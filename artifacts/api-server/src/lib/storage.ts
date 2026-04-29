import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");

export interface CrawledEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  link: string;
  source: string;
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
    return JSON.parse(raw) as CrawledEvent[];
  } catch {
    return [];
  }
}

export async function saveEvents(events: CrawledEvent[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
}

export async function appendEvents(newEvents: CrawledEvent[]): Promise<{ added: number; total: number }> {
  const existing = await readEvents();
  const existingIds = new Set(existing.map((e) => e.id));
  const fresh = newEvents.filter((e) => !existingIds.has(e.id));
  const merged = [...existing, ...fresh];
  await saveEvents(merged);
  return { added: fresh.length, total: merged.length };
}
