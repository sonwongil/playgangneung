/**
 * Meta Marketing API 실시간 광고비 모니터링 라우트
 * GET  /api/meta/spend          — 계정+캠페인+광고세트+광고 단위 오늘 지출
 * GET  /api/meta/budget-limits  — 내부 캠페인 예산 한도 목록
 * POST /api/meta/budget-limits  — 내부 예산 한도 저장 (upsert)
 * DELETE /api/meta/budget-limits/:campaignId — 내부 예산 한도 삭제
 * POST /api/meta/campaigns/:id/pause  — 캠페인 일시정지
 * POST /api/meta/campaigns/:id/resume — 캠페인 재개
 * POST /api/meta/adsets/:id/pause     — 광고세트 일시정지
 * POST /api/meta/adsets/:id/resume    — 광고세트 재개
 */
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { metaCampaignBudgetsTable } from "@workspace/db/schema";
import {
  isConfigured,
  getAccountSpend,
  getCampaignsWithSpend,
  getAdSetsWithSpend,
  getAdsWithSpend,
  updateCampaignStatus,
  updateAdSetStatus,
} from "../lib/metaApi.js";

const router = Router();

// ─── 통합 지출 현황 조회 ──────────────────────────────────────────────────────────
router.get("/meta/spend", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  if (!isConfigured()) return res.status(503).json({ error: "Meta API가 설정되지 않았습니다", configured: false });

  try {
    const [accountRes, campaignsRes] = await Promise.all([
      getAccountSpend(),
      getCampaignsWithSpend(),
    ]);

    const budgetLimits = await db.select().from(metaCampaignBudgetsTable);
    const limitMap = new Map(budgetLimits.map((b) => [b.campaignId, b.dailyLimit]));

    const campaigns = campaignsRes.ok ? campaignsRes.data.campaigns.map((c) => {
      const limit = limitMap.get(c.id) ?? null;
      const usagePct = limit && limit > 0 ? Math.round((c.todaySpend / limit) * 100) : null;
      return { ...c, internalDailyLimit: limit, usagePct };
    }) : [];

    const account = accountRes.ok ? accountRes.data : null;

    return res.json({
      configured: true,
      account,
      campaigns,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Meta 지출 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

// ─── 캠페인별 광고세트+광고 상세 조회 ────────────────────────────────────────────
router.get("/meta/spend/campaign/:id", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  if (!isConfigured()) return res.status(503).json({ error: "Meta API가 설정되지 않았습니다", configured: false });

  const { id } = req.params as { id: string };
  try {
    const [adsetsRes, adsRes] = await Promise.all([
      getAdSetsWithSpend(id),
      getAdsWithSpend(id),
    ]);
    return res.json({
      adsets: adsetsRes.ok ? adsetsRes.data.adsets : [],
      ads: adsRes.ok ? adsRes.data.ads : [],
    });
  } catch (err) {
    req.log.error({ err, campaignId: id }, "캠페인 상세 지출 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

// ─── 내부 예산 한도 목록 ─────────────────────────────────────────────────────────
router.get("/meta/budget-limits", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const limits = await db.select().from(metaCampaignBudgetsTable);
    return res.json({ limits });
  } catch (err) {
    req.log.error({ err }, "예산 한도 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

// ─── 내부 예산 한도 저장 (upsert) ────────────────────────────────────────────────
router.post("/meta/budget-limits", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  const { campaignId, campaignName, dailyLimit } = req.body as {
    campaignId?: string;
    campaignName?: string;
    dailyLimit?: number;
  };
  if (!campaignId || dailyLimit == null || dailyLimit < 0) {
    return res.status(400).json({ error: "campaignId, dailyLimit(≥0) 필수" });
  }
  try {
    await db
      .insert(metaCampaignBudgetsTable)
      .values({ campaignId, campaignName: campaignName ?? "", dailyLimit, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: metaCampaignBudgetsTable.campaignId,
        set: { campaignName: campaignName ?? "", dailyLimit, updatedAt: new Date() },
      });
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "예산 한도 저장 실패");
    return res.status(500).json({ error: "저장 실패" });
  }
});

// ─── 내부 예산 한도 삭제 ─────────────────────────────────────────────────────────
router.delete("/meta/budget-limits/:campaignId", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  const { campaignId } = req.params as { campaignId: string };
  try {
    await db.delete(metaCampaignBudgetsTable).where(eq(metaCampaignBudgetsTable.campaignId, campaignId));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "예산 한도 삭제 실패");
    return res.status(500).json({ error: "삭제 실패" });
  }
});

// ─── 캠페인 일시정지 / 재개 ──────────────────────────────────────────────────────
router.post("/meta/campaigns/:id/pause", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  if (!isConfigured()) return res.status(503).json({ error: "Meta API가 설정되지 않았습니다" });
  const { id } = req.params as { id: string };
  try {
    const result = await updateCampaignStatus(id, "PAUSED");
    if (!result.ok) return res.status(502).json({ error: result.error });
    req.log.info({ campaignId: id }, "캠페인 PAUSED 처리");
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, campaignId: id }, "캠페인 일시정지 실패");
    return res.status(500).json({ error: "처리 실패" });
  }
});

router.post("/meta/campaigns/:id/resume", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  if (!isConfigured()) return res.status(503).json({ error: "Meta API가 설정되지 않았습니다" });
  const { id } = req.params as { id: string };
  try {
    const result = await updateCampaignStatus(id, "ACTIVE");
    if (!result.ok) return res.status(502).json({ error: result.error });
    req.log.info({ campaignId: id }, "캠페인 ACTIVE 재개");
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, campaignId: id }, "캠페인 재개 실패");
    return res.status(500).json({ error: "처리 실패" });
  }
});

// ─── 광고세트 일시정지 / 재개 ────────────────────────────────────────────────────
router.post("/meta/adsets/:id/pause", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  if (!isConfigured()) return res.status(503).json({ error: "Meta API가 설정되지 않았습니다" });
  const { id } = req.params as { id: string };
  try {
    const result = await updateAdSetStatus(id, "PAUSED");
    if (!result.ok) return res.status(502).json({ error: result.error });
    req.log.info({ adSetId: id }, "광고세트 PAUSED 처리");
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, adSetId: id }, "광고세트 일시정지 실패");
    return res.status(500).json({ error: "처리 실패" });
  }
});

router.post("/meta/adsets/:id/resume", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  if (!isConfigured()) return res.status(503).json({ error: "Meta API가 설정되지 않았습니다" });
  const { id } = req.params as { id: string };
  try {
    const result = await updateAdSetStatus(id, "ACTIVE");
    if (!result.ok) return res.status(502).json({ error: result.error });
    req.log.info({ adSetId: id }, "광고세트 ACTIVE 재개");
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, adSetId: id }, "광고세트 재개 실패");
    return res.status(500).json({ error: "처리 실패" });
  }
});

export default router;
