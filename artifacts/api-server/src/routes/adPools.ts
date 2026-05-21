import { Router } from "express";
import crypto from "crypto";
import { db, adsTable, adPoolsTable, rotationRulesTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";

const router = Router();

export type AdPoolStatus = "draft" | "active" | "paused" | "ended";
export type AdPoolObjective = "awareness" | "conversion" | "traffic" | "engagement";
export type AdPoolAiMode = "equal" | "performance" | "manual";

export interface AdPool {
  id: string;
  name: string;
  objective: AdPoolObjective;
  adIds: string[];
  totalBudget: number;
  startDate: string;
  endDate: string;
  aiMode: AdPoolAiMode;
  status: AdPoolStatus;
  createdAt: string;
  updatedAt: string;
}

function rowToPool(row: typeof adPoolsTable.$inferSelect): AdPool {
  return {
    id: row.id,
    name: row.name,
    objective: (row.objective as AdPoolObjective) ?? "awareness",
    adIds: (row.adIds as string[]) ?? [],
    totalBudget: row.totalBudget,
    startDate: row.startDate,
    endDate: row.endDate,
    aiMode: (row.aiMode as AdPoolAiMode) ?? "equal",
    status: (row.status as AdPoolStatus) ?? "draft",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/ad-pools", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const rows = await db.select().from(adPoolsTable).orderBy(desc(adPoolsTable.createdAt));
    return res.json({ pools: rows.map(rowToPool), total: rows.length });
  } catch (err) {
    req.log.error({ err }, "ad-pools 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

router.get("/ad-pools/:id", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const { id } = req.params;
    const [row] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    if (!row) return res.status(404).json({ error: "묶음을 찾을 수 없습니다" });
    return res.json({ pool: rowToPool(row) });
  } catch (err) {
    req.log.error({ err }, "ad-pool 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

router.post("/ad-pools", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const body = req.body as Partial<AdPool>;
    const id = crypto.randomUUID();
    const adIds = Array.isArray(body.adIds) ? body.adIds : [];
    await db.insert(adPoolsTable).values({
      id,
      name: body.name ?? "새 묶음",
      objective: body.objective ?? "awareness",
      adIds,
      totalBudget: body.totalBudget ?? 0,
      startDate: body.startDate ?? "",
      endDate: body.endDate ?? "",
      aiMode: body.aiMode ?? "equal",
      status: "draft",
    });
    if (adIds.length > 0) {
      const slots = 24;
      const perAd = Math.floor(slots / adIds.length);
      const rules = adIds.flatMap((adId, adIdx) =>
        Array.from({ length: perAd }, (_, i) => ({
          id: crypto.randomUUID(),
          poolId: id,
          adId,
          hourSlot: adIdx * perAd + i,
          weight: 1,
          status: "active",
        }))
      );
      if (rules.length > 0) await db.insert(rotationRulesTable).values(rules);
    }
    const [row] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    req.log.info({ id }, "ad-pool 생성 완료");
    return res.status(201).json({ success: true, pool: rowToPool(row) });
  } catch (err) {
    req.log.error({ err }, "ad-pool 생성 실패");
    return res.status(500).json({ error: "생성 실패" });
  }
});

router.patch("/ad-pools/:id", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const { id } = req.params;
    const body = req.body as Partial<AdPool>;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if ("name" in body) patch.name = body.name;
    if ("objective" in body) patch.objective = body.objective;
    if ("adIds" in body) patch.adIds = body.adIds;
    if ("totalBudget" in body) patch.totalBudget = body.totalBudget;
    if ("startDate" in body) patch.startDate = body.startDate;
    if ("endDate" in body) patch.endDate = body.endDate;
    if ("aiMode" in body) patch.aiMode = body.aiMode;
    await db.update(adPoolsTable).set(patch).where(eq(adPoolsTable.id, id));
    const [row] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    if (!row) return res.status(404).json({ error: "묶음을 찾을 수 없습니다" });
    req.log.info({ id }, "ad-pool 수정 완료");
    return res.json({ success: true, pool: rowToPool(row) });
  } catch (err) {
    req.log.error({ err }, "ad-pool 수정 실패");
    return res.status(500).json({ error: "수정 실패" });
  }
});

router.patch("/ad-pools/:id/status", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const { id } = req.params;
    const { status } = req.body as { status: AdPoolStatus };
    await db.update(adPoolsTable).set({ status, updatedAt: new Date() }).where(eq(adPoolsTable.id, id));
    const [row] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    if (!row) return res.status(404).json({ error: "묶음을 찾을 수 없습니다" });
    req.log.info({ id, status }, "ad-pool 상태 변경");
    return res.json({ success: true, pool: rowToPool(row) });
  } catch (err) {
    req.log.error({ err }, "ad-pool 상태 변경 실패");
    return res.status(500).json({ error: "상태 변경 실패" });
  }
});

router.post("/ad-pools/:id/ads", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const { id } = req.params;
    const { adId } = req.body as { adId: string };
    const [row] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    if (!row) return res.status(404).json({ error: "묶음을 찾을 수 없습니다" });
    const current = (row.adIds as string[]) ?? [];
    if (!current.includes(adId)) {
      await db.update(adPoolsTable).set({ adIds: [...current, adId], updatedAt: new Date() }).where(eq(adPoolsTable.id, id));
    }
    const [updated] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    return res.json({ success: true, pool: rowToPool(updated) });
  } catch (err) {
    req.log.error({ err }, "ad-pool 광고 추가 실패");
    return res.status(500).json({ error: "추가 실패" });
  }
});

router.delete("/ad-pools/:id/ads/:adId", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const { id, adId } = req.params;
    const [row] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    if (!row) return res.status(404).json({ error: "묶음을 찾을 수 없습니다" });
    const current = (row.adIds as string[]) ?? [];
    await db.update(adPoolsTable).set({ adIds: current.filter((a) => a !== adId), updatedAt: new Date() }).where(eq(adPoolsTable.id, id));
    const [updated] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    return res.json({ success: true, pool: rowToPool(updated) });
  } catch (err) {
    req.log.error({ err }, "ad-pool 광고 제거 실패");
    return res.status(500).json({ error: "제거 실패" });
  }
});

router.get("/ad-pools/:id/rotation", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const { id } = req.params;
    const rules = await db.select().from(rotationRulesTable).where(eq(rotationRulesTable.poolId, id));
    const [pool] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    if (!pool) return res.status(404).json({ error: "묶음을 찾을 수 없습니다" });
    const adIds = (pool.adIds as string[]) ?? [];
    const adsRows = adIds.length > 0 ? await db.select().from(adsTable).where(inArray(adsTable.id, adIds)) : [];
    const slots = Array.from({ length: 24 }, (_, hour) => {
      const rule = rules.find((r) => r.hourSlot === hour);
      const ad = rule ? adsRows.find((a) => a.id === rule.adId) : null;
      return {
        hour,
        adId: rule?.adId ?? null,
        adName: ad?.businessName ?? ad?.title ?? null,
        weight: rule?.weight ?? 1,
        status: rule?.status ?? "unassigned",
      };
    });
    return res.json({ slots, pool: rowToPool(pool) });
  } catch (err) {
    req.log.error({ err }, "rotation 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

export default router;
