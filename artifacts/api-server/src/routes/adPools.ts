import { Router } from "express";
import crypto from "crypto";
import { db, adsTable, adPoolsTable, rotationRulesTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

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
        aiReason: (rule?.aiReason as string | null) ?? null,
      };
    });
    return res.json({ slots, pool: rowToPool(pool) });
  } catch (err) {
    req.log.error({ err }, "rotation 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

// ─── AI 편성표 생성 ────────────────────────────────────────────────────────────
router.post("/ad-pools/:id/generate-rotation", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const { id } = req.params;
    const [pool] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    if (!pool) return res.status(404).json({ error: "묶음을 찾을 수 없습니다" });

    const adIds = (pool.adIds as string[]) ?? [];
    if (adIds.length === 0) return res.status(400).json({ error: "참여 광고가 없습니다" });

    const adsRows = await db.select().from(adsTable).where(inArray(adsTable.id, adIds));
    const aiMode = (pool.aiMode as string) ?? "equal";

    // 전략별 가중치 계산
    type WeightedAd = { adId: string; name: string; weight: number; aiScore: number };
    let weightedAds: WeightedAd[] = adsRows.map((a) => ({
      adId: a.id,
      name: a.businessName || a.title,
      weight: 1,
      aiScore: (a.aiScore as number | null) ?? 70,
    }));

    if (aiMode === "performance") {
      // 성과 기반: aiScore 높을수록 가중치 높음
      const total = weightedAds.reduce((s, a) => s + a.aiScore, 0);
      weightedAds = weightedAds.map((a) => ({ ...a, weight: total > 0 ? a.aiScore / total : 1 / weightedAds.length }));
    } else if (aiMode === "manual") {
      // 균등 (수동 모드에서도 기본 균등)
      weightedAds = weightedAds.map((a) => ({ ...a, weight: 1 / weightedAds.length }));
    } else {
      // equal: 균등 분배
      weightedAds = weightedAds.map((a) => ({ ...a, weight: 1 / weightedAds.length }));
    }

    // AI로 편성 근거 및 슬롯 배정 생성
    let slotAssignments: { hourSlot: number; adId: string; weight: number; status: string; aiReason: string }[] = [];

    try {
      const prompt = `당신은 SNS 광고 편성 전문가입니다.
다음 광고 묶음을 24시간 타임슬롯에 최적 배정해주세요.

묶음 이름: ${pool.name}
광고 목적: ${pool.objective}
편성 방식: ${aiMode}
참여 광고:
${weightedAds.map((a, i) => `${i + 1}. ${a.name} (AI점수: ${a.aiScore}점)`).join("\n")}

규칙:
- 24개 시간대(0~23시)에 각 광고를 배정
- ${aiMode === "performance" ? "AI점수 높은 광고를 피크타임(09~21시)에 더 많이 배정" : "균등하게 순환 배정"}
- 동일 광고 연속 3시간 이상 금지
- 각 광고 최소 ${Math.floor(24 / weightedAds.length)}시간 이상 보장

JSON 배열로만 응답:
[{"hour":0,"adId":"광고ID","status":"active","reason":"배정 이유 한 줄"}]`;

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = response.choices[0]?.message?.content ?? "[]";
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { hour: number; adId: string; status: string; reason: string }[];
        slotAssignments = parsed.map((p) => {
          const wAd = weightedAds.find((w) => w.name === p.adId || w.adId === p.adId) ?? weightedAds[p.hour % weightedAds.length];
          return {
            hourSlot: p.hour,
            adId: wAd.adId,
            weight: wAd.weight,
            status: p.status ?? "active",
            aiReason: p.reason ?? "",
          };
        });
      }
    } catch (_aiErr) {
      // AI 실패 시 균등 분배 폴백
    }

    // AI 응답 없거나 불완전 시 균등 분배로 보완
    if (slotAssignments.length < 24) {
      slotAssignments = Array.from({ length: 24 }, (_, hour) => {
        const wAd = weightedAds[hour % weightedAds.length];
        const isBoostHour = hour >= 9 && hour <= 21 && aiMode === "performance";
        const topAd = aiMode === "performance"
          ? [...weightedAds].sort((a, b) => b.aiScore - a.aiScore)[hour % weightedAds.length] ?? wAd
          : wAd;
        return {
          hourSlot: hour,
          adId: isBoostHour ? topAd.adId : wAd.adId,
          weight: wAd.weight,
          status: isBoostHour && aiMode === "performance" ? "boost" : "active",
          aiReason: aiMode === "equal" ? "균등 순환 배정" : `${aiMode} 전략 기반 자동 배정`,
        };
      });
    }

    // 기존 룰 삭제 후 새로 저장
    await db.delete(rotationRulesTable).where(eq(rotationRulesTable.poolId, id));
    const rules = slotAssignments.map((s) => ({
      id: crypto.randomUUID(),
      poolId: id,
      adId: s.adId,
      hourSlot: s.hourSlot,
      weight: Math.round(s.weight * 100),
      status: s.status,
      aiReason: s.aiReason,
    }));
    if (rules.length > 0) await db.insert(rotationRulesTable).values(rules);

    req.log.info({ poolId: id, count: rules.length, aiMode }, "AI 편성표 생성 완료");
    return res.json({ success: true, count: rules.length, aiMode });
  } catch (err) {
    req.log.error({ err }, "AI 편성표 생성 실패");
    return res.status(500).json({ error: "편성표 생성 실패" });
  }
});

export default router;
