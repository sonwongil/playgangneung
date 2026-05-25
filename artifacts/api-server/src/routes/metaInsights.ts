/**
 * Meta Ad Insights 모니터링 라우트
 * GET  /api/meta/insights          — 저장된 최신 Insights 조회
 * POST /api/meta/insights/collect  — 즉시 수집 (수동 트리거)
 * GET  /api/meta/insights/history  — 특정 광고 히스토리
 */
import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { metaAdInsightsTable } from "@workspace/db/schema";
import { getAdInsights as getAccountAdInsights, isConfigured, type AdInsightRow } from "../lib/metaApi.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ─── 룰 기반 건강상태 판정 ─────────────────────────────────────────────────────
export interface HealthResult {
  status: "ok" | "warning" | "critical";
  issues: string[];
}

export function judgeHealth(row: AdInsightRow): HealthResult {
  const issues: string[] = [];

  // CTR 기준: 전환/트래픽 목적 광고 기준 Facebook 평균 ~0.9%
  if (row.impressions >= 1000) {
    const ctr = row.ctr ?? (row.impressions > 0 ? (row.clicks / row.impressions) * 100 : null);
    if (ctr !== null) {
      if (ctr < 0.3) issues.push(`CTR ${ctr.toFixed(2)}% — 심각하게 낮음 (기준: 0.3% 미만)`);
      else if (ctr < 0.7) issues.push(`CTR ${ctr.toFixed(2)}% — 낮음 (기준: 0.7% 미만)`);
    }
  }

  // Frequency 기준: 동일 사람에게 너무 자주 노출 → 광고 피로도 상승
  if (row.frequency !== null) {
    if (row.frequency >= 5) issues.push(`Frequency ${row.frequency.toFixed(1)} — 매우 높음 (동일인 5회 이상 노출)`);
    else if (row.frequency >= 3) issues.push(`Frequency ${row.frequency.toFixed(1)} — 높음 (동일인 3회 이상 노출)`);
  }

  // CPC 기준: 한국 SNS 광고 평균 CPC ~500원
  if (row.clicks >= 10 && row.cpc !== null) {
    if (row.cpc > 2000) issues.push(`CPC ₩${Math.round(row.cpc).toLocaleString()} — 매우 높음 (기준: ₩2,000 초과)`);
    else if (row.cpc > 1000) issues.push(`CPC ₩${Math.round(row.cpc).toLocaleString()} — 높음 (기준: ₩1,000 초과)`);
  }

  // 노출 0 — 게재 문제
  if (row.impressions === 0 && row.status === "ACTIVE") {
    issues.push("노출 0 — 광고가 활성 상태지만 게재되지 않고 있음");
  }

  // 지출 0 인데 ACTIVE
  if (row.spend === 0 && row.status === "ACTIVE" && row.impressions === 0) {
    issues.push("지출 없음 — 예산 소진 또는 게재 제한 가능성");
  }

  const hasCritical = issues.some((i) => i.includes("심각") || i.includes("매우"));
  const status = issues.length === 0 ? "ok" : hasCritical ? "critical" : "warning";
  return { status, issues };
}

// ─── 수집 + DB 저장 공통 로직 ─────────────────────────────────────────────────
export async function collectAndSave(datePreset: "today" | "yesterday" | "last_7d" | "last_30d" = "today") {
  const res = await getAccountAdInsights(datePreset);
  if (!res.ok) return { ok: false as const, error: res.error, collected: 0 };

  const rows = res.data.insights;
  let saved = 0;

  for (const row of rows) {
    if (!row.adId) continue;
    const health = judgeHealth(row);
    try {
      await db
        .insert(metaAdInsightsTable)
        .values({
          id: `${row.adId}_${row.dateStart}`,
          adId: row.adId,
          adName: row.adName,
          adSetId: row.adSetId || null,
          adSetName: row.adSetName || null,
          campaignId: row.campaignId || null,
          campaignName: row.campaignName || null,
          dateStart: row.dateStart,
          dateStop: row.dateStop,
          impressions: row.impressions,
          clicks: row.clicks,
          spend: row.spend,
          reach: row.reach,
          frequency: row.frequency ?? null,
          ctr: row.ctr ?? null,
          cpc: row.cpc ?? null,
          cpp: row.cpp ?? null,
          status: row.status,
          healthStatus: health.status,
          healthIssues: health.issues,
          collectedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [metaAdInsightsTable.adId, metaAdInsightsTable.dateStart],
          set: {
            impressions: row.impressions,
            clicks: row.clicks,
            spend: row.spend,
            reach: row.reach,
            frequency: row.frequency ?? null,
            ctr: row.ctr ?? null,
            cpc: row.cpc ?? null,
            cpp: row.cpp ?? null,
            status: row.status,
            healthStatus: health.status,
            healthIssues: health.issues,
            collectedAt: new Date(),
          },
        });
      saved++;
    } catch (err) {
      logger.warn({ err, adId: row.adId }, "Insights 저장 실패 (개별 건)");
    }
  }

  return { ok: true as const, collected: rows.length, saved };
}

// ─── GET /api/meta/insights — 최신 저장 데이터 반환 ─────────────────────────────
router.get("/meta/insights", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });

  const dateParam = (req.query["date"] as string) || "";

  try {
    const rows = await db
      .select()
      .from(metaAdInsightsTable)
      .where(dateParam ? eq(metaAdInsightsTable.dateStart, dateParam) : undefined)
      .orderBy(desc(metaAdInsightsTable.collectedAt));

    // 광고별 최신 1건씩 (dateParam 없을 때)
    const seen = new Set<string>();
    const latest = dateParam ? rows : rows.filter((r) => {
      if (seen.has(r.adId)) return false;
      seen.add(r.adId);
      return true;
    });

    const summary = {
      total: latest.length,
      ok: latest.filter((r) => r.healthStatus === "ok").length,
      warning: latest.filter((r) => r.healthStatus === "warning").length,
      critical: latest.filter((r) => r.healthStatus === "critical").length,
      lastCollectedAt: rows[0]?.collectedAt ?? null,
    };

    return res.json({ configured: isConfigured(), insights: latest, summary });
  } catch (err) {
    req.log.error({ err }, "Insights 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

// ─── POST /api/meta/insights/collect — 수동 즉시 수집 ───────────────────────────
router.post("/meta/insights/collect", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  if (!isConfigured()) return res.status(503).json({ error: "Meta API가 설정되지 않았습니다" });

  const datePreset = (req.body?.datePreset as "today" | "yesterday" | "last_7d" | "last_30d") ?? "today";

  try {
    const result = await collectAndSave(datePreset);
    if (!result.ok) return res.status(502).json({ error: result.error });
    req.log.info({ collected: result.collected, saved: result.saved }, "Meta Insights 수동 수집 완료");
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Meta Insights 수집 실패");
    return res.status(500).json({ error: "수집 실패" });
  }
});

// ─── GET /api/meta/insights/history/:adId — 특정 광고 7일 히스토리 ──────────────
router.get("/meta/insights/history/:adId", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  const { adId } = req.params as { adId: string };

  try {
    const rows = await db
      .select()
      .from(metaAdInsightsTable)
      .where(eq(metaAdInsightsTable.adId, adId))
      .orderBy(desc(metaAdInsightsTable.dateStart))
      .limit(30);
    return res.json({ history: rows });
  } catch (err) {
    req.log.error({ err, adId }, "Insights 히스토리 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

export default router;
