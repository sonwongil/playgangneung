import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { db, eventsTable, adsTable } from "@workspace/db";
import { eq, desc, and, isNotNull } from "drizzle-orm";

const router = Router();

// ─── 회원별 제출 내역 (관리자 전용) ──────────────────────────────────────────
router.get("/admin/members", requireAdmin, async (req, res) => {
  try {
    const tips = await db
      .select({
        userId: eventsTable.userId,
        authorDisplayName: eventsTable.authorDisplayName,
        id: eventsTable.id,
        title: eventsTable.title,
        status: eventsTable.status,
        crawledAt: eventsTable.crawledAt,
      })
      .from(eventsTable)
      .where(and(eq(eventsTable.sourceType, "tip"), isNotNull(eventsTable.userId)))
      .orderBy(desc(eventsTable.updatedAt));

    const ads = await db
      .select({
        userId: adsTable.userId,
        id: adsTable.id,
        title: adsTable.title,
        businessName: adsTable.businessName,
        status: adsTable.status,
        createdAt: adsTable.createdAt,
      })
      .from(adsTable)
      .where(isNotNull(adsTable.userId))
      .orderBy(desc(adsTable.createdAt));

    // 회원별 집계
    const memberMap = new Map<string, {
      userId: string;
      displayName: string | null;
      tipCount: number;
      adCount: number;
      lastActivity: string;
      tips: typeof tips;
      ads: typeof ads;
    }>();

    for (const t of tips) {
      if (!t.userId) continue;
      if (!memberMap.has(t.userId)) {
        memberMap.set(t.userId, {
          userId: t.userId,
          displayName: t.authorDisplayName,
          tipCount: 0,
          adCount: 0,
          lastActivity: t.crawledAt,
          tips: [],
          ads: [],
        });
      }
      const m = memberMap.get(t.userId)!;
      m.tipCount++;
      m.tips.push(t);
      if (t.crawledAt > m.lastActivity) m.lastActivity = t.crawledAt;
      // displayName 업데이트 (최신값 사용)
      if (t.authorDisplayName) m.displayName = t.authorDisplayName;
    }

    for (const a of ads) {
      if (!a.userId) continue;
      if (!memberMap.has(a.userId)) {
        memberMap.set(a.userId, {
          userId: a.userId,
          displayName: null,
          tipCount: 0,
          adCount: 0,
          lastActivity: a.createdAt.toISOString(),
          tips: [],
          ads: [],
        });
      }
      const m = memberMap.get(a.userId)!;
      m.adCount++;
      m.ads.push(a);
      const adAt = a.createdAt.toISOString();
      if (adAt > m.lastActivity) m.lastActivity = adAt;
    }

    const members = [...memberMap.values()].sort(
      (a, b) => b.lastActivity.localeCompare(a.lastActivity),
    );

    return res.json({ members, total: members.length });
  } catch (err) {
    req.log.error({ err }, "회원 목록 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

export default router;
