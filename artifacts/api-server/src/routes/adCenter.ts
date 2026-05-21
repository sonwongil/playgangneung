import { Router } from "express";
import { db, adsTable, adPoolsTable } from "@workspace/db";

const router = Router();

router.get("/ad-center/stats", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const today = new Date().toISOString().slice(0, 10);
    const allAds = await db.select().from(adsTable);
    const allPools = await db.select().from(adPoolsTable);

    const total = allAds.length;
    const active = allAds.filter((a) => a.status === "published" || a.status === "scheduled").length;
    const pending = allAds.filter((a) => a.status === "pending").length;
    const needsReview = allAds.filter((a) => {
      const score = a.aiScore as number | null;
      return score !== null && score < 60;
    }).length;
    const todayBudget = allPools
      .filter((p) => {
        const s = p.status as string;
        return s === "active" && p.startDate <= today && p.endDate >= today;
      })
      .reduce((sum, p) => sum + ((p.totalBudget as number) ?? 0), 0);

    const activePools = allPools.filter((p) => p.status === "active").length;
    const draftPools = allPools.filter((p) => p.status === "draft").length;

    return res.json({
      stats: { total, active, pending, needsReview, todayBudget, activePools, draftPools },
    });
  } catch (err) {
    req.log.error({ err }, "ad-center stats 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

router.get("/ad-center/alerts", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const allAds = await db.select().from(adsTable);
    const allPools = await db.select().from(adPoolsTable);
    const today = new Date().toISOString().slice(0, 10);

    const alerts: { type: string; level: "info" | "warning" | "error"; message: string; adId?: string }[] = [];

    allAds.forEach((ad) => {
      const score = ad.aiScore as number | null;
      if (score !== null && score < 60) {
        alerts.push({
          type: "ai_score",
          level: "warning",
          message: `[${ad.businessName || ad.title}] AI 검수 점수 ${score}점 — 문구 보정 필요`,
          adId: ad.id,
        });
      }
      if (ad.status === "pending") {
        const created = new Date(ad.createdAt);
        const diffDays = Math.floor((Date.now() - created.getTime()) / 86400000);
        if (diffDays >= 2) {
          alerts.push({
            type: "pending_long",
            level: "info",
            message: `[${ad.businessName || ad.title}] ${diffDays}일 이상 접수 대기 중`,
            adId: ad.id,
          });
        }
      }
    });

    allPools.forEach((pool) => {
      if (pool.status === "active" && pool.endDate && pool.endDate < today) {
        alerts.push({
          type: "pool_expired",
          level: "error",
          message: `묶음 [${pool.name}] 운영 기간이 종료되었습니다. 상태를 업데이트하세요.`,
        });
      }
    });

    const pendingCount = allAds.filter((a) => a.status === "pending").length;
    if (pendingCount === 0 && allAds.length > 0) {
      alerts.push({ type: "all_clear", level: "info", message: "모든 광고가 처리되었습니다." });
    }

    return res.json({ alerts });
  } catch (err) {
    req.log.error({ err }, "ad-center alerts 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

export default router;
