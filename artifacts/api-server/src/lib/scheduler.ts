import * as cron from "node-cron";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { crawlAll } from "./crawler.js";
import { appendEvents } from "./storage.js";
import { logger } from "./logger.js";
import { db, adPoolsTable, adPerformancesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getCampaignInsights, isConfigured } from "./metaApi.js";

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

// ─── Meta 성과 수집 (매일 오전 08:00 KST) ────────────────────────────────────────
async function collectMetaPerformance() {
  if (!isConfigured()) return;
  logger.info("Meta 성과 자동 수집 시작");
  try {
    const activePools = await db
      .select()
      .from(adPoolsTable)
      .where(sql`${adPoolsTable.status} = 'active' AND ${adPoolsTable.metaCampaignId} IS NOT NULL`);

    let total = 0;
    for (const pool of activePools) {
      if (!pool.metaCampaignId) continue;
      const insights = await getCampaignInsights(pool.metaCampaignId, "yesterday");
      if (!insights.ok) {
        logger.warn({ poolId: pool.id, error: insights.error }, "Meta 성과 수집 실패");
        continue;
      }
      const rows = (insights.data as { data: { date_start: string; impressions?: string; clicks?: string; spend?: string; reach?: string }[] }).data ?? [];
      for (const row of rows) {
        await db.insert(adPerformancesTable).values({
          id: crypto.randomUUID(),
          adId: ((pool.adIds as string[]) ?? [])[0] ?? pool.id,
          poolId: pool.id,
          date: row.date_start,
          impressions: Number(row.impressions ?? 0),
          clicks: Number(row.clicks ?? 0),
          spend: Math.round(Number(row.spend ?? 0) * 100),
          reach: Number(row.reach ?? 0),
          source: "meta",
        }).onConflictDoNothing();
        total++;
      }
    }
    logger.info({ pools: activePools.length, total }, "Meta 성과 자동 수집 완료");
  } catch (err) {
    logger.error({ err }, "Meta 성과 자동 수집 오류");
  }
}

let currentTask: cron.ScheduledTask | null = null;
let performanceTask: cron.ScheduledTask | null = null;

function applySchedule(hour: number, minute: number) {
  if (currentTask) { currentTask.stop(); currentTask = null; }
  const expr = `${minute} ${hour} * * *`;
  currentTask = cron.schedule(expr, runCrawl, { timezone: "Asia/Seoul" });
  logger.info({ hour, minute }, "크롤링 스케줄 등록 완료");
}

export async function startScheduler() {
  const cfg = await readScheduleConfig();
  applySchedule(cfg.crawlHour, cfg.crawlMinute);
  // 매일 오전 08:00 KST Meta 성과 수집
  if (performanceTask) { performanceTask.stop(); }
  performanceTask = cron.schedule("0 8 * * *", collectMetaPerformance, { timezone: "Asia/Seoul" });
  logger.info("Meta 성과 수집 스케줄 등록 완료 (매일 08:00 KST)");
}

export async function reschedule(hour: number, minute: number) {
  await saveScheduleConfig({ crawlHour: hour, crawlMinute: minute });
  applySchedule(hour, minute);
}
