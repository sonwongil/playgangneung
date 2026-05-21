import { Router } from "express";
import crypto from "crypto";
import { db, adsTable, adPoolsTable, rotationRulesTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";

// lazy import — 서버 시작 시 크래시 방지 (환경변수 없는 경우 대비)
async function getOpenAI() {
  const { openai } = await import("@workspace/integrations-openai-ai-server");
  return openai;
}

const router = Router();

// ─── 전략별 결정론적 슬롯 빌더 ─────────────────────────────────────────────────
// poolId, aiMode, adsRows를 받아 rotationRules 삽입용 배열을 반환
type AdsRow = typeof adsTable.$inferSelect;
interface BuiltSlot {
  id: string;
  poolId: string;
  adId: string;
  hourSlot: number;
  weight: number;
  status: string;
  aiReason: string;
}

export function buildStrategySlots(poolId: string, aiMode: string, adsRows: AdsRow[]): BuiltSlot[] {
  if (adsRows.length === 0) return [];
  const n = adsRows.length;
  type WeightedAd = { adId: string; weight: number; aiScore: number; createdAt: Date };
  const weightedAds: WeightedAd[] = adsRows.map((a) => ({
    adId: a.id,
    weight: 1 / n,
    aiScore: (a.aiScore as number | null) ?? 70,
    createdAt: a.createdAt,
  }));

  const sortedByScore = [...weightedAds].sort((a, b) => b.aiScore - a.aiScore);
  const cutoff = Date.now() - 3 * 86400000;
  const newAds = weightedAds.filter((a) => a.createdAt.getTime() >= cutoff);
  const primeHours = new Set<number>([9,10,11,12,13,14,15,16,17,18,19,20,21]);

  const slots: BuiltSlot[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const isPrime = primeHours.has(hour);
    let chosen: WeightedAd = weightedAds[hour % n];
    let status = "active";
    let reason = "균등 순환 배정";

    if (aiMode === "performance") {
      chosen = isPrime
        ? sortedByScore[Math.floor((hour / 24) * sortedByScore.length) % sortedByScore.length]
        : weightedAds[hour % n];
      if (isPrime && sortedByScore[0]?.adId === chosen.adId) status = "boost";
      reason = isPrime
        ? `피크타임 — AI점수 상위 광고 (${chosen.aiScore}점)`
        : "비피크 균등 배정";
    } else if (aiMode === "overexposure_prevention") {
      const prev1 = slots[hour - 1]?.adId;
      const prev2 = slots[hour - 2]?.adId;
      let idx = hour % n;
      let tries = 0;
      while (tries < n && weightedAds[idx % n].adId === prev1 && weightedAds[idx % n].adId === prev2) {
        idx++;
        tries++;
      }
      chosen = weightedAds[idx % n];
      reason = `과노출 방지 — 연속 2시간 이상 동일 광고 제한 (${hour}시)`;
    } else if (aiMode === "new_ad_boost") {
      if (isPrime && newAds.length > 0) {
        chosen = newAds[Math.floor((hour / 24) * newAds.length) % newAds.length];
        status = "boost";
        reason = `신규 광고 피크타임 부스트 (${hour}시)`;
      } else {
        chosen = weightedAds[hour % n];
        reason = newAds.length > 0 ? "비피크 균등 배정" : "신규 광고 없음 — 균등 배정";
      }
    } else {
      // equal / manual
      reason = `${aiMode === "manual" ? "수동 기준" : "균등"} 순환 배정`;
    }

    slots.push({
      id: crypto.randomUUID(),
      poolId,
      adId: chosen.adId,
      hourSlot: hour,
      weight: Math.round(chosen.weight * 100) || 1,
      status,
      aiReason: reason,
    });
  }
  return slots;
}

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
    // 광고가 있으면 전략에 따라 편성표 자동 생성
    if (adIds.length > 0) {
      const adsRows = await db.select().from(adsTable).where(inArray(adsTable.id, adIds));
      const aiMode = body.aiMode ?? "equal";
      const rules = buildStrategySlots(id, aiMode, adsRows);
      if (rules.length > 0) await db.insert(rotationRulesTable).values(rules);
    }
    const [row] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    req.log.info({ id, aiMode: body.aiMode ?? "equal" }, "ad-pool 생성 완료 (자동 편성 포함)");
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
    const n = adsRows.length;

    const strategyLabel: Record<string, string> = {
      equal: "균등 분배", performance: "성과 기반",
      overexposure_prevention: "과노출 방지", new_ad_boost: "신규 광고 보정", manual: "수동",
    };
    const modeDesc: Record<string, string> = {
      equal: "24시간 균등 순환 배정",
      performance: "AI점수 높은 광고를 피크타임(09~21시)에 집중 배정",
      overexposure_prevention: "동일 광고 연속 2시간 초과 금지, 골고루 순환",
      new_ad_boost: "최근 추가된 신규 광고를 피크타임에 우선 배정",
      manual: "균등 분배 후 수동 조정 가능",
    };

    // 광고 이름/점수 맵 (AI 프롬프트용)
    type WA = { adId: string; name: string; aiScore: number };
    const wAds: WA[] = adsRows.map((a) => ({
      adId: a.id, name: a.businessName || a.title, aiScore: (a.aiScore as number | null) ?? 70,
    }));
    const validAdIdSet = new Set(wAds.map((a) => a.adId));

    type SlotItem = { hourSlot: number; adId: string; weight: number; status: string; aiReason: string };
    let slotAssignments: SlotItem[] = [];

    // ─── AI 편성 시도 (gpt-5-mini, lazy import) ────────────────────────────────
    try {
      const openai = await getOpenAI();
      const prompt = `당신은 SNS 광고 편성 전문가입니다.
아래 광고 묶음을 24시간(0~23시) 타임슬롯에 배정해주세요.

묶음: ${pool.name} | 목적: ${pool.objective}
전략: ${strategyLabel[aiMode] ?? aiMode} — ${modeDesc[aiMode] ?? ""}

참여 광고 (adId | 이름 | AI점수):
${wAds.map((a) => `${a.adId} | ${a.name} | ${a.aiScore}점`).join("\n")}

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
        const seenHours = new Set<number>();
        const validated: SlotItem[] = [];
        for (const p of parsed) {
          const hour = Number(p.hour);
          if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
          if (seenHours.has(hour)) continue;
          if (!validAdIdSet.has(p.adId)) continue;
          seenHours.add(hour);
          validated.push({
            hourSlot: hour,
            adId: p.adId,
            weight: Math.round((1 / n) * 100) || 1,
            status: ["active", "boost", "reduce", "scheduled"].includes(p.status ?? "") ? (p.status ?? "active") : "active",
            aiReason: typeof p.reason === "string" && p.reason.length > 0 ? p.reason : `AI 편성 (${hour}시)`,
          });
        }
        // 누락 시간대는 결정론적으로 보완
        const detFull = buildStrategySlots(id, aiMode, adsRows);
        for (const slot of detFull) {
          if (!seenHours.has(slot.hourSlot)) {
            validated.push({
              hourSlot: slot.hourSlot, adId: slot.adId, weight: slot.weight,
              status: slot.status, aiReason: `AI 미배정 보완 (${slot.hourSlot}시)`,
            });
            seenHours.add(slot.hourSlot);
          }
        }
        slotAssignments = validated.sort((a, b) => a.hourSlot - b.hourSlot);
      }
    } catch (_aiErr) {
      req.log.warn({ err: _aiErr }, "AI 편성 실패 — 결정론적 폴백 사용");
    }

    // ─── AI 응답 없으면 결정론적 폴백 ─────────────────────────────────────────
    if (slotAssignments.length < 24) {
      const detSlots = buildStrategySlots(id, aiMode, adsRows);
      slotAssignments = detSlots.map((s) => ({
        hourSlot: s.hourSlot, adId: s.adId, weight: s.weight,
        status: s.status, aiReason: s.aiReason,
      }));
    }

    // 기존 룰 삭제 후 새로 저장
    await db.delete(rotationRulesTable).where(eq(rotationRulesTable.poolId, id));
    const rules = slotAssignments.map((s) => ({
      id: crypto.randomUUID(), poolId: id,
      adId: s.adId, hourSlot: s.hourSlot,
      weight: s.weight, status: s.status, aiReason: s.aiReason,
    }));
    if (rules.length > 0) await db.insert(rotationRulesTable).values(rules);

    req.log.info({ poolId: id, count: rules.length, aiMode }, "AI 편성표 생성 완료");
    return res.json({ success: true, count: rules.length, aiMode });
  } catch (err) {
    req.log.error({ err }, "AI 편성표 생성 실패");
    return res.status(500).json({ error: "편성표 생성 실패" });
  }
});

// ─── Meta에 반영 (캠페인 → 광고세트 → 광고 자동 생성) ─────────────────────────────
router.post("/:id/push-to-meta", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  const { isConfigured, createCampaign, createAdSet } = await import("../lib/metaApi.js");
  if (!isConfigured()) {
    return res.status(503).json({
      error: "Meta API 환경변수 미설정",
      hint: "META_ACCESS_TOKEN 과 META_AD_ACCOUNT_ID 환경변수를 설정하세요.",
      configured: false,
    });
  }
  try {
    const { id } = req.params;
    const [pool] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    if (!pool) return res.status(404).json({ error: "묶음을 찾을 수 없습니다" });

    // 캠페인 생성
    const campaignRes = await createCampaign({
      name: `[PLAY강릉] ${pool.name}`,
      objective: pool.objective,
      status: "PAUSED",
    });
    if (!campaignRes.ok) return res.status(502).json({ error: `캠페인 생성 실패: ${campaignRes.error}` });
    const metaCampaignId = (campaignRes as { ok: true; data: { id: string } }).data.id;

    // 광고세트 생성
    const adSetRes = await createAdSet({
      name: `[PLAY강릉] ${pool.name} 광고세트`,
      campaignId: metaCampaignId,
      dailyBudget: Math.round(pool.totalBudget / 30),
      startTime: new Date(`${pool.startDate}T00:00:00+09:00`).toISOString(),
      endTime: new Date(`${pool.endDate}T23:59:59+09:00`).toISOString(),
    });
    if (!adSetRes.ok) return res.status(502).json({ error: `광고세트 생성 실패: ${adSetRes.error}` });
    const metaAdSetId = (adSetRes as { ok: true; data: { id: string } }).data.id;

    // DB 저장
    await db.update(adPoolsTable).set({
      metaCampaignId,
      metaAdSetId,
      metaSyncedAt: new Date(),
      metaSyncStatus: "synced",
      updatedAt: new Date(),
    }).where(eq(adPoolsTable.id, id));

    req.log.info({ poolId: id, metaCampaignId, metaAdSetId }, "Meta 캠페인 반영 완료");
    return res.json({ success: true, metaCampaignId, metaAdSetId });
  } catch (err) {
    req.log.error({ err }, "Meta 반영 실패");
    return res.status(500).json({ error: "Meta 반영 실패" });
  }
});

export default router;
