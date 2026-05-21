import * as cron from "node-cron";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { crawlAll } from "./crawler.js";
import { appendEvents } from "./storage.js";
import { logger } from "./logger.js";
import { db, adPoolsTable, adPerformancesTable, adsTable } from "@workspace/db";
import { eq, sql, and, inArray, isNotNull } from "drizzle-orm";
import { getCampaignInsights, getAdInsights, isConfigured } from "./metaApi.js";

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
      const adIds = (pool.adIds as string[]) ?? [];
      const since = new Date(Date.now() - 86400000).toISOString().slice(0, 10); // yesterday
      const until = since;

      // 광고별 metaAdId 있는 광고만 광고 단위 성과 수집
      const adsWithMeta = adIds.length > 0
        ? await db.select().from(adsTable)
            .where(and(inArray(adsTable.id, adIds), isNotNull(adsTable.metaAdId)))
        : [];

      const makeId = (adId: string, date: string) =>
        crypto.createHash("sha256").update(`${adId}|${pool.id}|${date}|meta`).digest("hex").slice(0, 32);

      type InsightRow = { date_start: string; impressions?: string; clicks?: string; spend?: string; reach?: string; ctr?: string; cpc?: string };
      if (adsWithMeta.length > 0) {
        for (const ad of adsWithMeta) {
          const adInsights = await getAdInsights(ad.metaAdId!, since, until);
          if (!adInsights.ok) { logger.warn({ adId: ad.id, error: adInsights.error }, "광고 단위 성과 수집 실패"); continue; }
          const adRows = (adInsights.data as { data: InsightRow[] }).data ?? [];
          for (const row of adRows) {
            const pid = makeId(ad.id, row.date_start);
            const impressions = Number(row.impressions ?? 0);
            const clicks = Number(row.clicks ?? 0);
            const spend = Math.round(Number(row.spend ?? 0) * 100);
            const reach = Number(row.reach ?? 0);
            const ctr = row.ctr != null ? Number(row.ctr) : null;
            const cpc = row.cpc != null ? Math.round(Number(row.cpc)) : null;
            await db.insert(adPerformancesTable).values({
              id: pid, adId: ad.id, poolId: pool.id, date: row.date_start,
              impressions, clicks, spend, reach, ctr, cpc, source: "meta",
            }).onConflictDoUpdate({ target: adPerformancesTable.id, set: { impressions, clicks, spend, reach, ctr, cpc } });
            total++;
          }
        }
      } else {
        // 캠페인 단위 폴백
        const rows = (insights.data as { data: InsightRow[] }).data ?? [];
        const firstAdId = adIds[0] ?? pool.id;
        for (const row of rows) {
          const pid = makeId(firstAdId, row.date_start);
          const impressions = Number(row.impressions ?? 0);
          const clicks = Number(row.clicks ?? 0);
          const spend = Math.round(Number(row.spend ?? 0) * 100);
          const reach = Number(row.reach ?? 0);
          const ctr = row.ctr != null ? Number(row.ctr) : null;
          const cpc = row.cpc != null ? Math.round(Number(row.cpc)) : null;
          await db.insert(adPerformancesTable).values({
            id: pid, adId: firstAdId, poolId: pool.id, date: row.date_start,
            impressions, clicks, spend, reach, ctr, cpc, source: "meta",
          }).onConflictDoUpdate({ target: adPerformancesTable.id, set: { impressions, clicks, spend, reach, ctr, cpc } });
          total++;
        }
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
