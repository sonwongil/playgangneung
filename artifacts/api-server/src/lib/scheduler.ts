import * as cron from "node-cron";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { crawlAll } from "./crawler.js";
import { appendEvents } from "./storage.js";
import { logger } from "./logger.js";
import { db, adPoolsTable, adPerformancesTable, adsTable, adAlertsTable, eventsTable } from "@workspace/db";
import { sql, and, inArray, isNotNull, ne, lt } from "drizzle-orm";
import { getCampaignInsights, getAdInsightsLegacy, isConfigured } from "./metaApi.js";
import { collectAndSave } from "../routes/metaInsights.js";

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
        const alertId = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
        await db.insert(adAlertsTable).values({
          id: alertId, type: "meta_error", level: "error",
          message: `Meta 성과 수집 실패 (풀: ${pool.name ?? pool.id}): ${insights.error}`,
          poolId: pool.id, resolved: 0,
        }).onConflictDoNothing();
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
          const adInsights = await getAdInsightsLegacy(ad.metaAdId!, since, until);
          if (!adInsights.ok) { logger.warn({ adId: ad.id, error: adInsights.error }, "광고 단위 성과 수집 실패"); continue; }
          const adRows = (adInsights.data as { data: InsightRow[] }).data ?? [];
          for (const row of adRows) {
            const pid = makeId(ad.id, row.date_start);
            const impressions = Number(row.impressions ?? 0);
            const clicks = Number(row.clicks ?? 0);
            const spend = Math.round(Number(row.spend ?? 0));
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
          const spend = Math.round(Number(row.spend ?? 0));
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

// ─── 만료 풀 자동 전환 (매일 자정 KST) ────────────────────────────────────────
async function autoExpirePools() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const expired = await db
      .select({ id: adPoolsTable.id, name: adPoolsTable.name })
      .from(adPoolsTable)
      .where(
        sql`${adPoolsTable.status} = 'active' AND ${adPoolsTable.endDate} IS NOT NULL AND ${adPoolsTable.endDate} < ${today}`,
      );
    if (expired.length === 0) return;
    const expiredIds = expired.map((p) => p.id);
    await db
      .update(adPoolsTable)
      .set({ status: "ended", updatedAt: new Date() } as any)
      .where(sql`${adPoolsTable.id} IN (${sql.join(expiredIds.map((id) => sql`${id}`), sql`, `)})`);
    for (const pool of expired) {
      const alertId = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
      await db.insert(adAlertsTable).values({
        id: alertId, type: "pool_expired", level: "info",
        message: `광고 풀 '${pool.name ?? pool.id}' 기간 만료로 자동 종료됨`,
        poolId: pool.id, resolved: 0,
      }).onConflictDoNothing();
    }
    logger.info({ count: expired.length, ids: expiredIds }, "만료 광고 풀 자동 전환 완료");
  } catch (err) {
    logger.error({ err }, "만료 광고 풀 자동 전환 오류");
  }
}

// ─── 미승인 크롤 콘텐츠 자동 삭제 (매일 새벽 03:00 KST) ─────────────────────────
const PURGE_DAYS = 10;

async function purgeOldUnapprovedEvents() {
  try {
    const cutoff = new Date(Date.now() - PURGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const result = await db
      .delete(eventsTable)
      .where(
        and(
          ne(eventsTable.status, "approved"),
          ne(eventsTable.sourceType, "manual"),
          lt(eventsTable.crawledAt, cutoff),
        ),
      );
    const count = result.rowCount ?? 0;
    if (count > 0) {
      logger.info({ count, cutoff }, `미승인 크롤 콘텐츠 ${count}건 자동 삭제 완료 (${PURGE_DAYS}일 경과)`);
    }
  } catch (err) {
    logger.error({ err }, "미승인 크롤 콘텐츠 자동 삭제 오류");
  }
}

// ─── DB 자동 백업 (매일 새벽 04:00 KST) ──────────────────────────────────────
async function runBackup() {
  // api-server 프로세스는 artifacts/api-server/ 에서 실행 → ../../ = workspace root
  const workspaceRoot = path.resolve(process.cwd(), "../..");
  const scriptPath = path.join(workspaceRoot, "scripts", "backup.sh");

  logger.info({ scriptPath }, "DB 자동 백업 시작");

  return new Promise<void>((resolve) => {
    const proc = spawn("bash", [scriptPath], {
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const lines: string[] = [];
    proc.stdout?.on("data", (chunk: Buffer) => {
      chunk.toString().split("\n").filter(Boolean).forEach((l) => lines.push(l));
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      chunk.toString().split("\n").filter(Boolean).forEach((l) => lines.push(`[stderr] ${l}`));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        logger.info({ lines }, "DB 자동 백업 완료");
      } else {
        logger.error({ code, lines }, "DB 자동 백업 실패");
      }
      resolve();
    });

    proc.on("error", (err) => {
      logger.error({ err }, "DB 자동 백업 스크립트 실행 오류");
      resolve();
    });
  });
}

let currentTask: cron.ScheduledTask | null = null;
let performanceTask: cron.ScheduledTask | null = null;
let expireTask: cron.ScheduledTask | null = null;
let purgeTask: cron.ScheduledTask | null = null;
let insightsTask: cron.ScheduledTask | null = null;
let keepAliveTask: cron.ScheduledTask | null = null;
let backupTask: cron.ScheduledTask | null = null;

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
  // 매일 자정 KST 만료 풀 자동 전환
  if (expireTask) { expireTask.stop(); }
  expireTask = cron.schedule("0 0 * * *", autoExpirePools, { timezone: "Asia/Seoul" });
  logger.info("만료 풀 자동 전환 스케줄 등록 완료 (매일 00:00 KST)");
  // 서버 시작 시 즉시 1회 실행 (누락 만료 처리)
  void autoExpirePools();
  // 매일 새벽 03:00 KST 미승인 크롤 콘텐츠 자동 삭제
  if (purgeTask) { purgeTask.stop(); }
  purgeTask = cron.schedule("0 3 * * *", purgeOldUnapprovedEvents, { timezone: "Asia/Seoul" });
  logger.info(`미승인 크롤 콘텐츠 자동 삭제 스케줄 등록 완료 (매일 03:00 KST, ${PURGE_DAYS}일 경과 시 삭제)`);
  void purgeOldUnapprovedEvents();
  // 1시간마다 Meta Ad Insights 수집
  if (insightsTask) { insightsTask.stop(); }
  insightsTask = cron.schedule("5 * * * *", async () => {
    if (!isConfigured()) return;
    logger.info("Meta Ad Insights 자동 수집 시작 (1시간 주기)");
    try {
      const r = await collectAndSave("today");
      if (r.ok) logger.info({ collected: r.collected, saved: r.saved }, "Meta Ad Insights 자동 수집 완료");
      else logger.warn({ error: r.error }, "Meta Ad Insights 자동 수집 실패");
    } catch (err) {
      logger.error({ err }, "Meta Ad Insights 자동 수집 오류");
    }
  }, { timezone: "Asia/Seoul" });
  logger.info("Meta Ad Insights 수집 스케줄 등록 완료 (매시 05분)");

  // DB 커넥션 워밍업 — 4분마다 경량 쿼리로 커넥션 풀 유지
  if (keepAliveTask) { keepAliveTask.stop(); }
  keepAliveTask = cron.schedule("*/4 * * * *", async () => {
    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      // 조용히 무시
    }
  });
  logger.info("DB 커넥션 keep-alive 스케줄 등록 완료 (4분 주기)");

  // 매일 새벽 04:00 KST 자동 백업 (DB + uploads/cards)
  if (backupTask) { backupTask.stop(); }
  backupTask = cron.schedule("0 4 * * *", runBackup, { timezone: "Asia/Seoul" });
  logger.info("DB 자동 백업 스케줄 등록 완료 (매일 04:00 KST)");
}

export async function reschedule(hour: number, minute: number) {
  await saveScheduleConfig({ crawlHour: hour, crawlMinute: minute });
  applySchedule(hour, minute);
}
