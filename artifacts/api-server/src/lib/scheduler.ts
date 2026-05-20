import * as cron from "node-cron";
import fs from "fs/promises";
import path from "path";
import { crawlAll } from "./crawler.js";
import { appendEvents } from "./storage.js";
import { logger } from "./logger.js";

const CONFIG_FILE = path.resolve(process.cwd(), "data/config.json");

export interface ScheduleConfig {
  crawlHour: number;
  crawlMinute: number;
}

const DEFAULT: ScheduleConfig = { crawlHour: 9, crawlMinute: 0 };

export async function readScheduleConfig(): Promise<ScheduleConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    const cfg = JSON.parse(raw) as Partial<ScheduleConfig>;
    return {
      crawlHour:   typeof cfg.crawlHour   === "number" ? cfg.crawlHour   : DEFAULT.crawlHour,
      crawlMinute: typeof cfg.crawlMinute === "number" ? cfg.crawlMinute : DEFAULT.crawlMinute,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export async function saveScheduleConfig(cfg: ScheduleConfig): Promise<void> {
  let existing: Record<string, unknown> = {};
  try { existing = JSON.parse(await fs.readFile(CONFIG_FILE, "utf-8")); } catch {}
  await fs.writeFile(CONFIG_FILE, JSON.stringify({ ...existing, ...cfg }, null, 2), "utf-8");
}

async function runCrawl() {
  logger.info("자동 크롤링 시작 (스케줄)");
  try {
    const results = await crawlAll();
    const allEvents = results.flatMap((r) => r.events);
    const fresh = allEvents.filter((e) => e.scheduleStatus !== "ended");
    const { added, updated, total } = await appendEvents(fresh);
    logger.info({ added, updated, total }, "자동 크롤링 완료");
  } catch (err) {
    logger.error({ err }, "자동 크롤링 실패");
  }
}

let currentTask: cron.ScheduledTask | null = null;

function applySchedule(hour: number, minute: number) {
  if (currentTask) { currentTask.stop(); currentTask = null; }
  const expr = `${minute} ${hour} * * *`;
  currentTask = cron.schedule(expr, runCrawl, { timezone: "Asia/Seoul" });
  logger.info({ hour, minute }, "크롤링 스케줄 등록 완료");
}

export async function startScheduler() {
  const cfg = await readScheduleConfig();
  applySchedule(cfg.crawlHour, cfg.crawlMinute);
}

export async function reschedule(hour: number, minute: number) {
  await saveScheduleConfig({ crawlHour: hour, crawlMinute: minute });
  applySchedule(hour, minute);
}
