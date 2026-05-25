/**
 * Meta Ad Insights 모니터링 라우트
 * GET  /api/meta/insights          — 저장된 최신 Insights + 광고주/묶음 정보 포함
 * POST /api/meta/insights/collect  — 즉시 수집 (수동 트리거)
 * GET  /api/meta/insights/history  — 특정 광고 히스토리
 */
import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { metaAdInsightsTable, adPoolsTable } from "@workspace/db/schema";
import { adsTable } from "@workspace/db/schema";
import { getAdInsights as getAccountAdInsights, isConfigured, type AdInsightRow } from "../lib/metaApi.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ─── 룰 기반 건강상태 판정 ─────────────────────────────────────────────────────
export interface HealthResult {
  status: "ok" | "warning" | "critical";
  issues: string[];
  tips: string[];
}

export function judgeHealth(row: AdInsightRow): HealthResult {
  const issues: string[] = [];
  const tips: string[] = [];

  if (row.impressions >= 1000) {
    const ctr = row.ctr ?? (row.impressions > 0 ? (row.clicks / row.impressions) * 100 : null);
    if (ctr !== null) {
      if (ctr < 0.3) {
        issues.push(`CTR ${ctr.toFixed(2)}% — 심각하게 낮음`);
        tips.push("광고 이미지/영상을 교체하세요. 첫 1~2초 안에 시선을 끌어야 합니다.");
        tips.push("광고 문구의 첫 줄을 더 강렬하게 바꿔보세요 (혜택·가격·숫자 강조).");
      } else if (ctr < 0.7) {
        issues.push(`CTR ${ctr.toFixed(2)}% — 낮음`);
        tips.push("CTA 버튼 문구를 '자세히 보기' → '지금 확인' 등으로 변경해보세요.");
        tips.push("타겟 오디언스를 더 좁혀서 관심도 높은 사람에게만 노출해보세요.");
      }
    }
  }

  if (row.frequency !== null) {
    if (row.frequency >= 5) {
      issues.push(`Frequency ${row.frequency.toFixed(1)} — 동일인 ${row.frequency.toFixed(0)}회 노출`);
      tips.push("소재를 교체하거나 타겟 범위를 넓혀 광고 피로도를 낮추세요.");
      tips.push("캠페인을 잠시 중단 후 새 소재로 재집행을 권장합니다.");
    } else if (row.frequency >= 3) {
      issues.push(`Frequency ${row.frequency.toFixed(1)} — 광고 피로도 주의`);
      tips.push("소재 변형(이미지·제목 교체)을 준비해두세요.");
    }
  }

  if (row.clicks >= 10 && row.cpc !== null) {
    if (row.cpc > 2000) {
      issues.push(`CPC ₩${Math.round(row.cpc).toLocaleString()} — 클릭 비용 매우 높음`);
      tips.push("입찰 전략을 '최저 비용'으로 변경하거나 일 예산을 조정하세요.");
      tips.push("경쟁이 낮은 시간대(새벽 2~6시)로 게재 일정을 조정해보세요.");
    } else if (row.cpc > 1000) {
      issues.push(`CPC ₩${Math.round(row.cpc).toLocaleString()} — 클릭 비용 높음`);
      tips.push("타겟을 좁혀 관심도 높은 사람에게 집중하면 CPC가 낮아질 수 있습니다.");
    }
  }

  if (row.impressions === 0 && row.status === "ACTIVE") {
    issues.push("노출 0 — 광고가 활성 상태지만 게재되지 않음");
    tips.push("Meta 광고 관리자에서 게재 오류 또는 정책 위반 여부를 확인하세요.");
    tips.push("예산이 소진되었는지 또는 오디언스 규모가 너무 좁지 않은지 확인하세요.");
  }

  if (row.reach > 0 && row.impressions > 0) {
    const freq = row.impressions / row.reach;
    if (freq >= 4 && (row.frequency ?? 0) < 3) {
      tips.push("도달 대비 노출 비율이 높습니다. 새로운 오디언스 확장을 고려하세요.");
    }
  }

  const hasCritical = issues.some((i) => i.includes("심각") || i.includes("매우") || i.includes("0"));
  const status = issues.length === 0 ? "ok" : hasCritical ? "critical" : "warning";
  return { status, issues, tips };
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
          healthIssues: [...health.issues, ...health.tips.map((t) => `💡 ${t}`)],
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
            healthIssues: [...health.issues, ...health.tips.map((t) => `💡 ${t}`)],
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

// ─── GET /api/meta/insights — 최신 저장 데이터 + 광고주/묶음 정보 반환 ──────────
router.get("/meta/insights", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });

  const dateParam = (req.query["date"] as string) || "";

  try {
    const [rows, allAds, allPools] = await Promise.all([
      db
        .select()
        .from(metaAdInsightsTable)
        .where(dateParam ? eq(metaAdInsightsTable.dateStart, dateParam) : undefined)
        .orderBy(desc(metaAdInsightsTable.collectedAt)),
      db.select({
        id: adsTable.id,
        metaAdId: adsTable.metaAdId,
        businessName: adsTable.businessName,
        title: adsTable.title,
      }).from(adsTable),
      db.select({
        id: adPoolsTable.id,
        name: adPoolsTable.name,
        adIds: adPoolsTable.adIds,
        status: adPoolsTable.status,
      }).from(adPoolsTable),
    ]);

    // metaAdId → { businessName, title, internalId } 맵
    const metaAdMap = new Map<string, { businessName: string; title: string; internalId: string }>();
    for (const ad of allAds) {
      if (ad.metaAdId) {
        metaAdMap.set(ad.metaAdId, {
          businessName: ad.businessName,
          title: ad.title,
          internalId: ad.id,
        });
      }
    }

    // internalAdId → [{ poolId, poolName }] 맵
    const adPoolMap = new Map<string, { poolId: string; poolName: string; poolStatus: string }[]>();
    for (const pool of allPools) {
      for (const adId of pool.adIds ?? []) {
        const existing = adPoolMap.get(adId) ?? [];
        existing.push({ poolId: pool.id, poolName: pool.name, poolStatus: pool.status });
        adPoolMap.set(adId, existing);
      }
    }

    // 광고별 최신 1건씩 (dateParam 없을 때)
    const seen = new Set<string>();
    const latest = dateParam
      ? rows
      : rows.filter((r) => {
          if (seen.has(r.adId)) return false;
          seen.add(r.adId);
          return true;
        });

    // 각 insight에 광고주/묶음 정보 합류
    const enriched = latest.map((r) => {
      const adInfo = metaAdMap.get(r.adId);
      const pools = adInfo ? (adPoolMap.get(adInfo.internalId) ?? []) : [];

      // healthIssues를 issues(문제)와 tips(개선제안)로 분리
      const issues = (r.healthIssues as string[]).filter((h) => !h.startsWith("💡"));
      const tips = (r.healthIssues as string[])
        .filter((h) => h.startsWith("💡"))
        .map((h) => h.replace(/^💡 /, ""));

      return {
        ...r,
        businessName: adInfo?.businessName ?? null,
        adTitle: adInfo?.title ?? null,
        internalAdId: adInfo?.internalId ?? null,
        pools,
        issues,
        tips,
      };
    });

    const summary = {
      total: enriched.length,
      ok: enriched.filter((r) => r.healthStatus === "ok").length,
      warning: enriched.filter((r) => r.healthStatus === "warning").length,
      critical: enriched.filter((r) => r.healthStatus === "critical").length,
      totalSpend: enriched.reduce((s, r) => s + r.spend, 0),
      totalImpressions: enriched.reduce((s, r) => s + r.impressions, 0),
      totalClicks: enriched.reduce((s, r) => s + r.clicks, 0),
      lastCollectedAt: rows[0]?.collectedAt ?? null,
    };

    return res.json({ configured: isConfigured(), insights: enriched, summary });
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

// ─── GET /api/meta/insights/history/:adId — 특정 광고 30일 히스토리 ──────────────
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
