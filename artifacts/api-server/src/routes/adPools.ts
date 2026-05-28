import { Router } from "express";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { db, adsTable, adPoolsTable, rotationRulesTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { CARDS_DIR } from "../lib/paths.js";

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
  const cutoff = Date.now() - 3 * 86400000;
  const newAds = adsRows.filter((a) => a.createdAt.getTime() >= cutoff);
  const primeHours = new Set<number>([9,10,11,12,13,14,15,16,17,18,19,20,21]);

  // [공정 노출 정책]
  // aiScore는 노출 순서 결정에 미사용.
  // 광고주는 계약(플랜) 기준 공정 노출을 보장받음.
  // aiScore < 60 → 관리자 개선 알림(adCenter alerts)으로만 활용.

  const slots: BuiltSlot[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const isPrime = primeHours.has(hour);
    let chosen: AdsRow = adsRows[hour % n];
    let status = "active";
    let reason = "균등 순환 배정";

    if (aiMode === "performance") {
      // 피크/비피크 모두 계약 기준 균등 순환 — AI 점수로 광고 간 차별 없음
      chosen = adsRows[hour % n];
      reason = isPrime
        ? `피크타임 균등 순환 — 계약 기준 공정 노출 (${hour}시)`
        : `비피크 균등 순환 (${hour}시)`;
    } else if (aiMode === "overexposure_prevention") {
      const prev1 = slots[hour - 1]?.adId;
      const prev2 = slots[hour - 2]?.adId;
      let idx = hour % n;
      let tries = 0;
      while (tries < n && adsRows[idx % n].id === prev1 && adsRows[idx % n].id === prev2) {
        idx++;
        tries++;
      }
      chosen = adsRows[idx % n];
      reason = `과노출 방지 — 연속 2시간 이상 동일 광고 제한 (${hour}시)`;
    } else if (aiMode === "new_ad_boost") {
      if (isPrime && newAds.length > 0) {
        chosen = newAds[Math.floor((hour / 24) * newAds.length) % newAds.length];
        status = "boost";
        reason = `신규 광고 피크타임 부스트 (${hour}시)`;
      } else {
        chosen = adsRows[hour % n];
        reason = newAds.length > 0 ? "비피크 균등 배정" : "신규 광고 없음 — 균등 배정";
      }
    } else {
      reason = `${aiMode === "manual" ? "수동 기준" : "균등"} 순환 배정`;
    }

    slots.push({
      id: crypto.randomUUID(),
      poolId,
      adId: chosen.id,
      hourSlot: hour,
      weight: Math.round((1 / n) * 100) || 1,
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
  metaCampaignId: string | null;
  metaAdSetId: string | null;
  metaSyncedAt: string | null;
  metaSyncStatus: string | null;
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
    metaCampaignId: row.metaCampaignId ?? null,
    metaAdSetId: row.metaAdSetId ?? null,
    metaSyncedAt: row.metaSyncedAt ? row.metaSyncedAt.toISOString() : null,
    metaSyncStatus: row.metaSyncStatus ?? null,
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

// ─── 카드 이미지 공개 URL 조회 헬퍼 ─────────────────────────────────────────────
async function resolveCardImageUrl(adId: string, imageUrl: string | null): Promise<string | null> {
  const SITE_URL = process.env["SITE_URL"] ?? "https://playgangneung.com";
  // 1) 생성된 카드이미지 우선 (thumb → 기본)
  for (const suffix of [`${adId}-thumb.png`, `${adId}.png`]) {
    try {
      await fs.access(path.join(CARDS_DIR, suffix));
      return `${SITE_URL}/api/cards/${suffix}`;
    } catch { /* 파일 없음 */ }
  }
  // 2) 원본 이미지 URL 폴백 (공개 URL이어야 Meta가 다운로드 가능)
  return imageUrl ?? null;
}

// ─── Meta에 반영 (캠페인 → 광고세트 → 이미지업로드 → Creative → Ad) ─────────────
router.post("/ad-pools/:id/push-to-meta", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });

  // 환경변수 사전 점검
  const missingEnv: string[] = [];
  if (!process.env["META_ACCESS_TOKEN"]) missingEnv.push("META_ACCESS_TOKEN");
  if (!process.env["META_AD_ACCOUNT_ID"]) missingEnv.push("META_AD_ACCOUNT_ID");
  if (!process.env["META_PAGE_ID"]) missingEnv.push("META_PAGE_ID");
  if (missingEnv.length > 0) {
    return res.status(503).json({
      error: `Meta API 환경변수 미설정: ${missingEnv.join(", ")}`,
      hint: `${missingEnv.join(", ")} 환경변수를 설정하세요.`,
      missingEnv,
      configured: false,
    });
  }

  const { isConfigured, createCampaign, createAdSet, createAd, uploadAdImage } = await import("../lib/metaApi.js");
  if (!isConfigured()) {
    return res.status(503).json({ error: "Meta API 환경변수 미설정", configured: false });
  }

  try {
    const { id } = req.params;
    const force = req.query["force"] === "true";
    const SITE_URL = process.env["SITE_URL"] ?? "https://playgangneung.com";
    const pageId = process.env["META_PAGE_ID"] as string;

    const [pool] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    if (!pool) return res.status(404).json({ error: "묶음을 찾을 수 없습니다" });

    const adIdList = (pool.adIds as string[]) ?? [];
    if (adIdList.length === 0) return res.status(400).json({ error: "풀에 광고가 없습니다" });

    // ── STEP 1. 캠페인 생성 ─────────────────────────────────────────────────────
    const campaignRes = await createCampaign({
      name: `[PLAY강릉] ${pool.name}`,
      objective: pool.objective,
      status: "PAUSED",
    });
    if (!campaignRes.ok) {
      return res.status(502).json({ error: `캠페인 생성 실패: ${campaignRes.error}`, failedStep: "campaign" });
    }
    const metaCampaignId = (campaignRes as { ok: true; data: { id: string } }).data.id;

    // 기간(일수) 계산 — 최소 1일
    const periodDays = Math.max(
      Math.round((new Date(pool.endDate).getTime() - new Date(pool.startDate).getTime()) / 86400000) + 1,
      1,
    );
    // 일 예산: 전체예산 ÷ 기간(일), 최소 10,000원 (Meta KRW 계정 최솟값 기준)
    const dailyBudgetPerDay = Math.max(Math.round(pool.totalBudget / periodDays), 10000);
    const startTime = new Date(`${pool.startDate}T00:00:00+09:00`).toISOString();
    const endTime = new Date(`${pool.endDate}T23:59:59+09:00`).toISOString();

    // ── STEP 2. 광고세트 1개 생성 (소상공인 광고 자동 순환) ──────────────────────
    // Meta 공동광고 구조: Campaign 1개 → AdSet 1개(통합 예산+타겟) → Ad N개(소상공인별 자동 순환)
    const adSetRes = await createAdSet({
      name: `[PLAY강릉] ${pool.name} 광고세트`,
      campaignId: metaCampaignId,
      dailyBudget: dailyBudgetPerDay,
      objective: pool.objective,
      startTime,
      endTime,
    });
    if (!adSetRes.ok) {
      return res.status(502).json({ error: `광고세트 생성 실패: ${adSetRes.error}`, failedStep: "adset" });
    }
    const firstAdSetId = (adSetRes as { ok: true; data: { id: string } }).data.id;
    const adAdSetMap: Record<string, string> = {};
    for (const adId of adIdList) adAdSetMap[adId] = firstAdSetId;

    const createdAdSetIds = [firstAdSetId];
    if (!firstAdSetId) {
      return res.status(502).json({ error: "광고세트 생성에 실패했습니다. Meta 연결 설정을 확인해주세요.", failedStep: "adset" });
    }

    // ── STEP 3. 광고별 이미지업로드 → Creative → Ad ────────────────────────────
    type SocialDraftShape = { caption?: string; title?: string; hashtags?: string[] };
    type AdResult = {
      adId: string;
      adName: string;
      metaAdId: string;
      metaCreativeId: string;
      metaImageHash: string;
      skipped: boolean;
      skipReason?: string;
      imageStep: "card" | "original" | "none";
    };
    const adResults: AdResult[] = [];

    const adsRows = await db.select().from(adsTable).where(inArray(adsTable.id, adIdList));

    for (const adRow of adsRows) {
      const adSetId = adAdSetMap[adRow.id] ?? firstAdSetId;

      // 중복 방지: metaAdId가 이미 있으면 force가 아닌 한 스킵
      if (adRow.metaAdId && !force) {
        adResults.push({
          adId: adRow.id, adName: adRow.title,
          metaAdId: adRow.metaAdId, metaCreativeId: adRow.metaCreativeId ?? "",
          metaImageHash: adRow.metaImageHash ?? "", skipped: true,
          skipReason: "이미 Meta Ad가 생성됨 (재생성하려면 재생성 버튼 사용)",
          imageStep: "none",
        });
        continue;
      }

      // Pre-flight: socialDraft 필수
      const draft = adRow.socialDraft as SocialDraftShape | null;
      if (!draft?.caption) {
        adResults.push({
          adId: adRow.id, adName: adRow.title,
          metaAdId: "", metaCreativeId: "", metaImageHash: "", skipped: true,
          skipReason: "SNS 초안(socialDraft)이 없습니다. 먼저 SNS 초안을 생성하세요.",
          imageStep: "none",
        });
        continue;
      }

      // 광고 문구: caption + hashtags 조합
      const adBody = [draft.caption, ...(draft.hashtags?.map((t) => `#${t.replace(/^#/, "")}`) ?? [])].join("\n");
      const adTitle = draft.title ?? adRow.title;

      // 랜딩 URL: SITE_URL/content/{id} 우선
      const landingUrl = `${SITE_URL}/content/${adRow.id}`;

      // 이미지: 카드이미지 > 원본 이미지 > 없음
      const resolvedImageUrl = await resolveCardImageUrl(adRow.id, adRow.imageUrl);
      const imageStep: AdResult["imageStep"] = resolvedImageUrl
        ? (resolvedImageUrl.includes("/api/cards/") ? "card" : "original")
        : "none";

      // Meta 이미지 업로드
      let imageHash: string | undefined;
      if (resolvedImageUrl) {
        const imgRes = await uploadAdImage(resolvedImageUrl);
        if (imgRes.ok) {
          imageHash = imgRes.data.hash;
          req.log.info({ adId: adRow.id, hash: imageHash, imageStep }, "Meta 이미지 업로드 완료");
        } else {
          req.log.warn({ adId: adRow.id, err: imgRes.error }, "Meta 이미지 업로드 실패");
        }
      }

      // Creative + Ad 생성
      const adRes = await createAd({
        name: `[PLAY강릉] ${adRow.title}`,
        adSetId,
        pageId,
        title: adTitle,
        body: adBody,
        imageHash,
        imageUrl: imageHash ? undefined : (resolvedImageUrl ?? undefined),
        linkUrl: landingUrl,
      });

      if (adRes.ok) {
        const { id: metaAdId, creativeId: metaCreativeId } = (adRes as { ok: true; data: { id: string; creativeId: string } }).data;
        // DB 저장: metaAdId, metaCreativeId, metaImageHash, metaStatus
        await db.update(adsTable).set({
          metaAdId,
          metaCreativeId,
          metaImageHash: imageHash ?? null,
          metaStatus: "PAUSED",
        } as any).where(eq(adsTable.id, adRow.id));

        adResults.push({
          adId: adRow.id, adName: adRow.title,
          metaAdId, metaCreativeId, metaImageHash: imageHash ?? "", skipped: false, imageStep,
        });
        req.log.info({ adId: adRow.id, metaAdId, metaCreativeId, imageStep }, "Meta 광고 소재+Ad 생성 완료");
      } else {
        const errMsg = (adRes as { ok: false; error: string }).error ?? "알 수 없는 오류";
        adResults.push({
          adId: adRow.id, adName: adRow.title,
          metaAdId: "", metaCreativeId: "", metaImageHash: "", skipped: true,
          skipReason: `광고 생성 실패: ${errMsg}`, imageStep,
        });
        req.log.warn({ adId: adRow.id, err: errMsg }, "Meta 광고 소재 생성 실패");
      }
    }

    // ── STEP 4. 풀 DB 저장 ────────────────────────────────────────────────────
    await db.update(adPoolsTable).set({
      metaCampaignId,
      metaAdSetId: firstAdSetId,
      metaSyncedAt: new Date(),
      metaSyncStatus: "synced",
      updatedAt: new Date(),
    }).where(eq(adPoolsTable.id, id));

    const created = adResults.filter((r) => !r.skipped);
    const skipped = adResults.filter((r) => r.skipped);

    req.log.info({
      poolId: id, metaCampaignId,
      adSetCount: createdAdSetIds.length,
      adsCreated: created.length,
      adsSkipped: skipped.length,
    }, "Meta 캠페인 전체 반영 완료");

    return res.json({
      success: true,
      steps: {
        campaign: { ok: true, id: metaCampaignId },
        adSets: { ok: true, count: createdAdSetIds.length, strategy: "single_adset_rotation" },
        ads: { created: created.length, skipped: skipped.length },
      },
      metaCampaignId,
      metaAdSetId: firstAdSetId,
      adsCreated: created.length,
      adsSkipped: skipped.length,
      adResults,
    });
  } catch (err) {
    req.log.error({ err }, "Meta 반영 실패");
    return res.status(500).json({ error: "Meta 반영 실패" });
  }
});

export default router;
