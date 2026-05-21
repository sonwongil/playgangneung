import { Router } from "express";
import crypto from "crypto";
import { db, adsTable, adPoolsTable, rotationRulesTable, adAlertsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

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

// ─── 알림 조회 (DB 영속 + 실시간 계산 병합) ──────────────────────────────────
router.get("/ad-center/alerts", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const dbAlerts = await db
      .select()
      .from(adAlertsTable)
      .where(eq(adAlertsTable.resolved, 0))
      .orderBy(desc(adAlertsTable.createdAt))
      .limit(50);

    const alerts = dbAlerts.map((a) => ({
      type: a.type,
      level: a.level as "info" | "warning" | "error",
      message: a.message,
      adId: a.adId ?? undefined,
      poolId: a.poolId ?? undefined,
      id: a.id,
    }));

    return res.json({ alerts });
  } catch (err) {
    req.log.error({ err }, "ad-center alerts 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

// ─── 알림 해제 ────────────────────────────────────────────────────────────────
router.patch("/ad-center/alerts/:id/resolve", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    await db
      .update(adAlertsTable)
      .set({ resolved: 1 })
      .where(eq(adAlertsTable.id, req.params.id));
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "alert resolve 실패");
    return res.status(500).json({ error: "처리 실패" });
  }
});

// ─── AI 알림 감지 + 영속 저장 ─────────────────────────────────────────────────
router.post("/ad-center/alerts/detect", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const today = new Date().toISOString().slice(0, 10);
    const allAds = await db.select().from(adsTable);
    const allPools = await db.select().from(adPoolsTable);
    const allRules = await db.select().from(rotationRulesTable);

    const newAlerts: {
      id: string; type: string; level: string; message: string; adId?: string; poolId?: string;
    }[] = [];

    // 1) AI 점수 낮은 광고 경고
    for (const ad of allAds) {
      const score = ad.aiScore as number | null;
      if (score !== null && score < 60) {
        newAlerts.push({
          id: crypto.randomUUID(),
          type: "ai_score_low",
          level: "warning",
          message: `[${ad.businessName || ad.title}] AI 검수 점수 ${score}점 — 문구 보정 필요`,
          adId: ad.id,
        });
      }
    }

    // 2) 2일 이상 미처리 대기 광고
    for (const ad of allAds) {
      if (ad.status === "pending") {
        const diffDays = Math.floor((Date.now() - ad.createdAt.getTime()) / 86400000);
        if (diffDays >= 2) {
          newAlerts.push({
            id: crypto.randomUUID(),
            type: "pending_long",
            level: "info",
            message: `[${ad.businessName || ad.title}] ${diffDays}일 이상 접수 대기 중`,
            adId: ad.id,
          });
        }
      }
    }

    // 3) 운영 기간 종료 묶음
    for (const pool of allPools) {
      if (pool.status === "active" && pool.endDate && pool.endDate < today) {
        newAlerts.push({
          id: crypto.randomUUID(),
          type: "pool_expired",
          level: "error",
          message: `묶음 [${pool.name}] 운영 기간이 종료되었습니다. 상태를 업데이트하세요.`,
          poolId: pool.id,
        });
      }
    }

    // 4) 과노출 감지: 동일 광고 연속 3시간 이상
    const poolIds = [...new Set(allRules.map((r) => r.poolId))];
    for (const poolId of poolIds) {
      const rules = allRules
        .filter((r) => r.poolId === poolId)
        .sort((a, b) => a.hourSlot - b.hourSlot);
      let streak = 1;
      for (let i = 1; i < rules.length; i++) {
        if (rules[i].adId === rules[i - 1].adId) {
          streak++;
          if (streak >= 3) {
            const overAd = allAds.find((a) => a.id === rules[i].adId);
            const pool = allPools.find((p) => p.id === poolId);
            newAlerts.push({
              id: crypto.randomUUID(),
              type: "overexposure",
              level: "warning",
              message: `묶음 [${(pool?.name) ?? poolId}] 광고 [${(overAd?.businessName || overAd?.title) ?? rules[i].adId}] 연속 ${streak}시간 과노출 감지`,
              adId: rules[i].adId,
              poolId,
            });
            break;
          }
        } else {
          streak = 1;
        }
      }
    }

    // 5) 저CTR 경고: ad_performances에서 CTR < 0.5% (데이터 있을 때만)
    // (Phase 3에서 실제 성과 데이터 연동 후 활성화 예정 — 현재는 테이블 구조만 준비)

    // 기존 미해결 알림과 중복 방지 (type + adId/poolId 조합)
    const existing = await db
      .select()
      .from(adAlertsTable)
      .where(eq(adAlertsTable.resolved, 0));
    const existingKeys = new Set(
      existing.map((a) => `${a.type}:${a.adId ?? ""}:${a.poolId ?? ""}`)
    );

    const toInsert = newAlerts.filter(
      (a) => !existingKeys.has(`${a.type}:${a.adId ?? ""}:${a.poolId ?? ""}`)
    );

    if (toInsert.length > 0) {
      await db.insert(adAlertsTable).values(
        toInsert.map((a) => ({
          id: a.id,
          type: a.type,
          level: a.level,
          message: a.message,
          adId: a.adId ?? null,
          poolId: a.poolId ?? null,
          resolved: 0,
        }))
      );
    }

    req.log.info({ detected: newAlerts.length, inserted: toInsert.length }, "알림 감지 완료");
    return res.json({
      success: true,
      detected: newAlerts.length,
      inserted: toInsert.length,
      skippedDuplicates: newAlerts.length - toInsert.length,
    });
  } catch (err) {
    req.log.error({ err }, "alert detect 실패");
    return res.status(500).json({ error: "알림 감지 실패" });
  }
});

export default router;
