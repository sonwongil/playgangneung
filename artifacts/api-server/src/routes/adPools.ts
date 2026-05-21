import { Router } from "express";
import crypto from "crypto";
import { db, adsTable, adPoolsTable, rotationRulesTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

export type AdPoolStatus = "draft" | "active" | "paused" | "ended";
export type AdPoolObjective = "awareness" | "conversion" | "traffic" | "engagement";
export type AdPoolAiMode = "equal" | "performance" | "overexposure_prevention" | "new_ad_boost" | "manual";

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

    // ─── 전략별 가중치 계산 ─────────────────────────────────────────────────────
    type WeightedAd = { adId: string; name: string; weight: number; aiScore: number; createdAt: Date };
    const n = adsRows.length;
    let weightedAds: WeightedAd[] = adsRows.map((a) => ({
      adId: a.id,
      name: a.businessName || a.title,
      weight: 1,
      aiScore: (a.aiScore as number | null) ?? 70,
      createdAt: a.createdAt,
    }));

    const strategyLabel: Record<string, string> = {
      equal: "균등 분배",
      performance: "성과 기반",
      overexposure_prevention: "과노출 방지",
      new_ad_boost: "신규 광고 보정",
      manual: "수동",
    };

    // ─── 결정론적 슬롯 빌더 (AI 없이도 동작하는 폴백 + 검증 기준) ─────────────
    function buildDeterministicSlots(mode: string): typeof slotAssignments {
      const slots: typeof slotAssignments = [];
      const sortedByScore = [...weightedAds].sort((a, b) => b.aiScore - a.aiScore);
      // 신규 광고: 최근 3일 이내 추가된 광고
      const cutoff = Date.now() - 3 * 86400000;
      const newAds = weightedAds.filter((a) => a.createdAt.getTime() >= cutoff);
      const primeHours = new Set<number>([9,10,11,12,13,14,15,16,17,18,19,20,21]);

      for (let hour = 0; hour < 24; hour++) {
        const isPrime = primeHours.has(hour);
        let chosen: WeightedAd;
        let status = "active";
        let reason = "균등 순환 배정";

        if (mode === "performance") {
          // 피크타임은 상위 광고, 비피크는 순환
          chosen = isPrime
            ? sortedByScore[Math.floor(hour / 24 * sortedByScore.length) % sortedByScore.length]
            : weightedAds[hour % n];
          if (isPrime && sortedByScore[0].adId === chosen.adId) status = "boost";
          reason = isPrime ? `피크타임 — AI점수 상위 광고 (${chosen.aiScore}점)` : "비피크 균등 배정";
        } else if (mode === "overexposure_prevention") {
          // 과노출 방지: 연속 2시간 이상 같은 광고 금지, 강제 순환
          const prev1 = slots[hour - 1]?.adId;
          const prev2 = slots[hour - 2]?.adId;
          let idx = hour % n;
          // 직전 2슬롯과 다른 광고 선택
          let tries = 0;
          while (tries < n && (weightedAds[idx % n].adId === prev1 && weightedAds[idx % n].adId === prev2)) {
            idx++;
            tries++;
          }
          chosen = weightedAds[idx % n];
          reason = `과노출 방지 — 연속 노출 제한 순환 (${hour}시)`;
        } else if (mode === "new_ad_boost") {
          // 신규 보정: 신규 광고가 있으면 피크타임 우선 배정
          if (isPrime && newAds.length > 0) {
            chosen = newAds[Math.floor(hour / 24 * newAds.length) % newAds.length];
            status = "boost";
            reason = `신규 광고 피크타임 부스트 (${chosen.name})`;
          } else {
            chosen = weightedAds[hour % n];
            reason = newAds.length > 0 ? "비피크 균등 배정" : "신규 광고 없음 — 균등 배정";
          }
        } else {
          // equal / manual: 순수 균등 순환
          chosen = weightedAds[hour % n];
          reason = `${strategyLabel[mode] ?? mode} 균등 순환`;
        }

        slots.push({
          hourSlot: hour,
          adId: chosen.adId,
          weight: chosen.weight,
          status,
          aiReason: reason,
        });
      }
      return slots;
    }

    type SlotItem = { hourSlot: number; adId: string; weight: number; status: string; aiReason: string };
    let slotAssignments: SlotItem[] = [];

    // ─── AI 편성 (gpt-5-mini) ──────────────────────────────────────────────────
    const validAdIdSet = new Set(weightedAds.map((a) => a.adId));
    try {
      const modeDesc: Record<string, string> = {
        equal: "24시간 균등 순환 배정",
        performance: "AI점수 높은 광고를 피크타임(09~21시)에 집중 배정",
        overexposure_prevention: "동일 광고 연속 2시간 초과 금지, 골고루 순환",
        new_ad_boost: "최근 추가된 신규 광고를 피크타임에 우선 배정",
        manual: "균등 분배 후 수동 조정 가능",
      };
      const prompt = `당신은 SNS 광고 편성 전문가입니다.
아래 광고 묶음을 24시간(0~23시) 타임슬롯에 배정해주세요.

묶음: ${pool.name} | 목적: ${pool.objective}
전략: ${strategyLabel[aiMode] ?? aiMode} — ${modeDesc[aiMode] ?? ""}

참여 광고 (adId | 이름 | AI점수):
${weightedAds.map((a) => `${a.adId} | ${a.name} | ${a.aiScore}점`).join("\n")}

필수 규칙:
- 반드시 24개 항목 (hour 0~23 각 1개씩, 중복 없음)
- adId는 위 목록에 있는 값만 사용
- 과노출 방지: 동일 adId 연속 3시간 이상 금지
- 각 광고 최소 ${Math.floor(24 / n)}시간 배정

JSON 배열만 반환 (설명 없이):
[{"hour":0,"adId":"실제adId","status":"active","reason":"한 줄 이유"}]`;

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = response.choices[0]?.message?.content ?? "[]";
      const jsonMatch = raw.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { hour: number; adId: string; status?: string; reason?: string }[];
        // 엄격 검증: 타입, 범위, 존재 여부, 중복
        const seenHours = new Set<number>();
        const validated: SlotItem[] = [];
        for (const p of parsed) {
          const hour = Number(p.hour);
          if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
          if (seenHours.has(hour)) continue;
          if (!validAdIdSet.has(p.adId)) continue;
          const wAd = weightedAds.find((w) => w.adId === p.adId)!;
          seenHours.add(hour);
          validated.push({
            hourSlot: hour,
            adId: wAd.adId,
            weight: wAd.weight,
            status: ["active", "boost", "reduce", "scheduled"].includes(p.status ?? "") ? (p.status ?? "active") : "active",
            aiReason: typeof p.reason === "string" && p.reason.length > 0 ? p.reason : `AI 편성 (${hour}시)`,
          });
        }
        // 24시간 완전 커버 여부 확인
        if (validated.length === 24) {
          slotAssignments = validated;
        } else {
          // 누락 시간대는 결정론적으로 보완
          const deterministicFull = buildDeterministicSlots(aiMode);
          for (const slot of deterministicFull) {
            if (!seenHours.has(slot.hourSlot)) {
              validated.push({ ...slot, aiReason: `AI 미배정 보완 (${slot.hourSlot}시)` });
              seenHours.add(slot.hourSlot);
            }
          }
          slotAssignments = validated.sort((a, b) => a.hourSlot - b.hourSlot);
        }
      }
    } catch (_aiErr) {
      req.log.warn({ err: _aiErr }, "AI 편성 실패 — 결정론적 폴백 사용");
    }

    // ─── AI 응답 없으면 결정론적 폴백 ─────────────────────────────────────────
    if (slotAssignments.length < 24) {
      slotAssignments = buildDeterministicSlots(aiMode);
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
