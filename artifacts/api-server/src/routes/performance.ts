import { Router } from "express";
import crypto from "crypto";
import { db, adPerformancesTable, adPoolsTable, adsTable } from "@workspace/db";
import { eq, and, gte, lte, desc, sql, inArray, isNotNull } from "drizzle-orm";
import { getCampaignInsights, getAdInsights, isConfigured, getLastRateLimit } from "../lib/metaApi.js";

/** 중복 방지용 결정론적 ID — (adId, poolId, date, source) 기반 sha256 앞 16자 */
function perfId(adId: string, poolId: string | null, date: string, source: string): string {
  return crypto.createHash("sha256").update(`${adId}|${poolId ?? ""}|${date}|${source}`).digest("hex").slice(0, 32);
}

const router = Router();

// ─── 풀별 성과 조회 ─────────────────────────────────────────────────────────────
router.get("/ad-pools/:id/performance", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const { id } = req.params;
    const since = (req.query["since"] as string) ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const until = (req.query["until"] as string) ?? new Date().toISOString().slice(0, 10);

    const [pool] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    if (!pool) return res.status(404).json({ error: "묶음을 찾을 수 없습니다" });

    const rows = await db
      .select()
      .from(adPerformancesTable)
      .where(
        and(
          eq(adPerformancesTable.poolId, id),
          gte(adPerformancesTable.date, since),
          lte(adPerformancesTable.date, until),
        )
      )
      .orderBy(adPerformancesTable.date);

    // 날짜별 집계
    const byDate: Record<string, { impressions: number; clicks: number; spend: number; reach: number }> = {};
    for (const r of rows) {
      const d = r.date;
      if (!byDate[d]) byDate[d] = { impressions: 0, clicks: 0, spend: 0, reach: 0 };
      byDate[d].impressions += r.impressions;
      byDate[d].clicks += r.clicks;
      byDate[d].spend += r.spend;
      byDate[d].reach += r.reach;
    }

    const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
    const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
    const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
    const totalReach = rows.reduce((s, r) => s + r.reach, 0);
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    const dailyChart = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        impressions: v.impressions,
        clicks: v.clicks,
        spend: v.spend,
        ctr: v.impressions > 0 ? Number(((v.clicks / v.impressions) * 100).toFixed(2)) : 0,
      }));

    // 광고별 breakdown (adId 기준 집계 + 광고 제목 조회)
    const byAd: Record<string, { impressions: number; clicks: number; spend: number; title: string; businessName: string }> = {};
    for (const r of rows) {
      if (!byAd[r.adId]) byAd[r.adId] = { impressions: 0, clicks: 0, spend: 0, title: r.adId.slice(-8), businessName: "" };
      byAd[r.adId].impressions += r.impressions;
      byAd[r.adId].clicks += r.clicks;
      byAd[r.adId].spend += r.spend;
    }
    const adIdKeys = Object.keys(byAd);
    if (adIdKeys.length > 0) {
      const adRows = await db.select({ id: adsTable.id, title: adsTable.title, businessName: adsTable.businessName })
        .from(adsTable).where(inArray(adsTable.id, adIdKeys));
      for (const a of adRows) {
        if (byAd[a.id]) { byAd[a.id].title = a.title; byAd[a.id].businessName = a.businessName; }
      }
    }
    const adBreakdown = Object.entries(byAd)
      .map(([adId, v]) => ({
        adId, title: v.title, businessName: v.businessName,
        impressions: v.impressions, clicks: v.clicks, spend: v.spend,
        ctr: v.impressions > 0 ? Number(((v.clicks / v.impressions) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions);

    return res.json({
      pool: { id: pool.id, name: pool.name, totalBudget: pool.totalBudget, metaCampaignId: pool.metaCampaignId },
      summary: {
        totalImpressions, totalClicks, totalSpend, totalReach,
        ctr: Number(ctr.toFixed(2)), cpc: Number(cpc.toFixed(0)),
        budgetUsedPct: pool.totalBudget > 0 ? Number(((totalSpend / pool.totalBudget) * 100).toFixed(1)) : 0,
      },
      dailyChart,
      adBreakdown,
      since,
      until,
    });
  } catch (err) {
    req.log.error({ err }, "풀 성과 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

// ─── 광고별 성과 조회 ────────────────────────────────────────────────────────────
router.get("/ads/:id/performance", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const { id } = req.params;
    const since = (req.query["since"] as string) ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const until = (req.query["until"] as string) ?? new Date().toISOString().slice(0, 10);

    const [ad] = await db.select().from(adsTable).where(eq(adsTable.id, id));
    if (!ad) return res.status(404).json({ error: "광고를 찾을 수 없습니다" });

    const rows = await db
      .select()
      .from(adPerformancesTable)
      .where(
        and(
          eq(adPerformancesTable.adId, id),
          gte(adPerformancesTable.date, since),
          lte(adPerformancesTable.date, until),
        )
      )
      .orderBy(adPerformancesTable.date);

    const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
    const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
    const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    const dailyChart = rows.map((r) => ({
      date: r.date,
      impressions: r.impressions,
      clicks: r.clicks,
      spend: r.spend,
      ctr: r.impressions > 0 ? Number(((r.clicks / r.impressions) * 100).toFixed(2)) : 0,
    }));

    return res.json({
      ad: { id: ad.id, title: ad.title, businessName: ad.businessName, metaAdId: ad.metaAdId },
      summary: { totalImpressions, totalClicks, totalSpend, ctr: Number(ctr.toFixed(2)) },
      dailyChart,
      since,
      until,
    });
  } catch (err) {
    req.log.error({ err }, "광고 성과 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

// ─── 샘플 성과 데이터 시딩 (테스트용) ───────────────────────────────────────────
router.post("/performance/seed", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const { poolId } = req.body as { poolId?: string };
    if (!poolId) return res.status(400).json({ error: "poolId 필수" });

    const [pool] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, poolId));
    if (!pool) return res.status(404).json({ error: "묶음을 찾을 수 없습니다" });

    const adIds = (pool.adIds as string[]) ?? [];
    if (adIds.length === 0) return res.status(400).json({ error: "묶음에 광고가 없습니다. 먼저 광고를 추가하세요." });

    const today = new Date();
    let saved = 0;

    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const d = new Date(today);
      d.setDate(d.getDate() - dayOffset);
      const dateStr = d.toISOString().slice(0, 10);

      for (const adId of adIds) {
        // 현실적인 랜덤 성과 생성: 노출 500~5000, CTR 1~4%, 지출은 노출 기반
        const impressions = Math.floor(Math.random() * 4500) + 500;
        const ctr = (Math.random() * 3 + 1) / 100; // 1~4%
        const clicks = Math.floor(impressions * ctr);
        const cpc = Math.floor(Math.random() * 400) + 100; // 100~500원
        const spend = clicks * cpc;
        const reach = Math.floor(impressions * (0.6 + Math.random() * 0.3)); // 노출의 60~90%

        const pid = perfId(adId, poolId, dateStr, "sample");
        await db.insert(adPerformancesTable).values({
          id: pid,
          adId,
          poolId,
          date: dateStr,
          impressions,
          clicks,
          spend,
          reach,
          source: "sample",
        }).onConflictDoUpdate({
          target: adPerformancesTable.id,
          set: { impressions, clicks, spend, reach },
        });
        saved++;
      }
    }

    req.log.info({ poolId, saved, adCount: adIds.length }, "샘플 성과 데이터 시딩 완료");
    return res.status(201).json({ success: true, saved, days: 30, adCount: adIds.length });
  } catch (err) {
    req.log.error({ err }, "샘플 데이터 시딩 실패");
    return res.status(500).json({ error: "시딩 실패" });
  }
});

// ─── 수동 성과 입력 ──────────────────────────────────────────────────────────────
router.post("/performance/manual", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const body = req.body as {
      adId: string; poolId?: string; date: string;
      impressions?: number; clicks?: number; spend?: number; reach?: number;
    };
    if (!body.adId || !body.date) return res.status(400).json({ error: "adId, date 필수" });

    const pid = perfId(body.adId, body.poolId ?? null, body.date, "manual");
    await db.insert(adPerformancesTable).values({
      id: pid,
      adId: body.adId,
      poolId: body.poolId ?? null,
      date: body.date,
      impressions: body.impressions ?? 0,
      clicks: body.clicks ?? 0,
      spend: body.spend ?? 0,
      reach: body.reach ?? 0,
      source: "manual",
    }).onConflictDoUpdate({
      target: adPerformancesTable.id,
      set: {
        impressions: body.impressions ?? 0,
        clicks: body.clicks ?? 0,
        spend: body.spend ?? 0,
        reach: body.reach ?? 0,
      },
    });

    req.log.info({ adId: body.adId, date: body.date }, "성과 수동 입력");
    return res.status(201).json({ success: true });
  } catch (err) {
    req.log.error({ err }, "성과 수동 입력 실패");
    return res.status(500).json({ error: "입력 실패" });
  }
});

// ─── Meta API 성과 즉시 수집 (단일 풀) ──────────────────────────────────────────
router.post("/ad-pools/:id/collect-performance", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  if (!isConfigured()) {
    return res.status(503).json({
      error: "Meta API 환경변수 미설정 (META_ACCESS_TOKEN, META_AD_ACCOUNT_ID)",
      hint: "환경변수를 설정하면 실제 Meta 성과 데이터를 수집합니다.",
    });
  }
  try {
    const { id } = req.params;
    const [pool] = await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, id));
    if (!pool) return res.status(404).json({ error: "묶음을 찾을 수 없습니다" });
    if (!pool.metaCampaignId) return res.status(400).json({ error: "Meta 캠페인이 연동되지 않았습니다. 먼저 'Meta에 반영'을 실행하세요." });

    const adIds = (pool.adIds as string[]) ?? [];
    const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    let saved = 0;

    // 광고별 metaAdId 조회 — metaAdId 있는 광고만 광고 단위 성과 수집
    const adsWithMeta = adIds.length > 0
      ? await db.select().from(adsTable)
          .where(and(inArray(adsTable.id, adIds), isNotNull(adsTable.metaAdId)))
      : [];

    if (adsWithMeta.length > 0) {
      // 광고 단위 성과 수집 (정확한 광고별 데이터)
      for (const ad of adsWithMeta) {
        const insights = await getAdInsights(ad.metaAdId!, since, until);
        if (!insights.ok) { req.log.warn({ adId: ad.id, error: insights.error }, "광고 단위 성과 수집 실패"); continue; }
        const rows = (insights.data as { data: { date_start: string; impressions?: string; clicks?: string; spend?: string; reach?: string; ctr?: string; cpc?: string }[] }).data ?? [];
        for (const row of rows) {
          const pid = perfId(ad.id, id, row.date_start, "meta");
          const impressions = Number(row.impressions ?? 0);
          const clicks = Number(row.clicks ?? 0);
          const spend = Math.round(Number(row.spend ?? 0));
          const reach = Number(row.reach ?? 0);
          const ctr = row.ctr != null ? Number(row.ctr) : null;
          const cpc = row.cpc != null ? Math.round(Number(row.cpc)) : null;
          await db.insert(adPerformancesTable).values({
            id: pid, adId: ad.id, poolId: id, date: row.date_start,
            impressions, clicks, spend, reach, ctr, cpc, source: "meta",
          }).onConflictDoUpdate({ target: adPerformancesTable.id, set: { impressions, clicks, spend, reach, ctr, cpc } });
          saved++;
        }
      }
    } else {
      // metaAdId 없는 경우 캠페인 단위 폴백 (firstAdId에 집계)
      const firstAdId = adIds[0] ?? id;
      const insights = await getCampaignInsights(pool.metaCampaignId, "last_7d");
      if (!insights.ok) return res.status(502).json({ error: `Meta API 오류: ${insights.error}` });
      const rows = (insights.data as { data: { date_start: string; impressions?: string; clicks?: string; spend?: string; reach?: string; ctr?: string; cpc?: string }[] }).data ?? [];
      for (const row of rows) {
        const pid = perfId(firstAdId, id, row.date_start, "meta");
        const impressions = Number(row.impressions ?? 0);
        const clicks = Number(row.clicks ?? 0);
        const spend = Math.round(Number(row.spend ?? 0));
        const reach = Number(row.reach ?? 0);
        const ctr = row.ctr != null ? Number(row.ctr) : null;
        const cpc = row.cpc != null ? Math.round(Number(row.cpc)) : null;
        await db.insert(adPerformancesTable).values({
          id: pid, adId: firstAdId, poolId: id, date: row.date_start,
          impressions, clicks, spend, reach, ctr, cpc, source: "meta",
        }).onConflictDoUpdate({ target: adPerformancesTable.id, set: { impressions, clicks, spend, reach, ctr, cpc } });
        saved++;
      }
    }

    req.log.info({ poolId: id, saved, adCount: adsWithMeta.length }, "Meta 성과 수동 수집 완료");
    return res.json({ success: true, saved, adLevelCount: adsWithMeta.length, campaign: pool.metaCampaignId });
  } catch (err) {
    req.log.error({ err }, "Meta 성과 수집 실패");
    return res.status(500).json({ error: "수집 실패" });
  }
});

// ─── 정산 관리: 기간 만료 풀 자동 종료 처리 ────────────────────────────────────────
router.post("/billing/expire-pools", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const today = new Date().toISOString().slice(0, 10);
    const expiredPools = await db
      .select()
      .from(adPoolsTable)
      .where(sql`${adPoolsTable.status} = 'active' AND ${adPoolsTable.endDate} < ${today}`);

    let expired = 0;
    for (const pool of expiredPools) {
      await db.update(adPoolsTable).set({ status: "ended", updatedAt: new Date() }).where(eq(adPoolsTable.id, pool.id));
      expired++;
    }
    req.log.info({ expired }, "기간 만료 풀 자동 종료 처리");
    return res.json({ success: true, expired });
  } catch (err) {
    req.log.error({ err }, "정산 만료 처리 실패");
    return res.status(500).json({ error: "처리 실패" });
  }
});

// ─── 정산 현황 조회 ──────────────────────────────────────────────────────────────
router.get("/billing/summary", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const today = new Date().toISOString().slice(0, 10);
    const pools = await db.select().from(adPoolsTable).orderBy(desc(adPoolsTable.createdAt));

    const summaries = await Promise.all(
      pools.map(async (pool) => {
        const spendRows = await db
          .select({ totalSpend: sql<number>`coalesce(sum(${adPerformancesTable.spend}), 0)` })
          .from(adPerformancesTable)
          .where(eq(adPerformancesTable.poolId, pool.id));

        const totalSpend = Number(spendRows[0]?.totalSpend) || 0;
        const totalBudget = pool.totalBudget as number ?? 0;
        const spendPct = totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0;

        const poolStart = pool.startDate ? new Date(pool.startDate).getTime() : 0;
        const poolEnd = pool.endDate ? new Date(pool.endDate).getTime() : 0;
        const now = Date.now();
        const elapsedPct = poolEnd > poolStart && poolEnd > now
          ? Math.round(((now - poolStart) / (poolEnd - poolStart)) * 100)
          : (pool.endDate < today ? 100 : 0);

        return {
          id: pool.id,
          name: pool.name,
          status: pool.status,
          startDate: pool.startDate,
          endDate: pool.endDate,
          totalBudget,
          totalSpend,
          spendPct,
          elapsedPct: Math.min(100, Math.max(0, elapsedPct)),
          isExpired: pool.status === "active" && pool.endDate < today,
          adCount: ((pool.adIds as string[]) ?? []).length,
          metaSynced: !!pool.metaCampaignId,
        };
      })
    );

    return res.json({ summaries, today });
  } catch (err) {
    req.log.error({ err }, "정산 현황 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

// ─── Meta Rate-limit 현황 조회 ───────────────────────────────────────────────────
router.get("/meta/rate-limit", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  const status = getLastRateLimit();
  return res.json({
    configured: isConfigured(),
    rateLimit: status,
    warning: status && status.callCount >= 80
      ? `API 호출 한도 ${status.callCount}% 소진 — 주의 필요`
      : null,
  });
});

// ─── 이메일·전화번호로 내 광고 조회 (공개) ───────────────────────────────────────
router.post("/public/lookup-ad", async (req, res) => {
  try {
    const body = req.body as { email?: string; phone?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const phone = (body.phone ?? "").trim().replace(/[^0-9]/g, "");

    if (!email && !phone) {
      return res.status(400).json({ error: "이메일 또는 전화번호를 입력하세요" });
    }

    const ads = await db.select().from(adsTable);
    const matched = ads.filter((ad) => {
      if (ad.status === "rejected") return false;
      if (email && ad.email.trim().toLowerCase() === email) return true;
      if (phone && ad.phone.replace(/[^0-9]/g, "") === phone) return true;
      return false;
    });

    if (matched.length === 0) {
      return res.status(404).json({ error: "일치하는 광고를 찾을 수 없습니다. 이메일 또는 전화번호를 확인해 주세요." });
    }

    // 토큰이 없는 광고는 자동 발급
    const results = await Promise.all(
      matched.map(async (ad) => {
        let token = ad.reportToken;
        if (!token) {
          token = crypto.randomBytes(24).toString("base64url");
          await db.update(adsTable).set({ reportToken: token }).where(eq(adsTable.id, ad.id));
        }
        return {
          id: ad.id,
          title: ad.title,
          businessName: ad.businessName,
          status: ad.status,
          plan: ad.plan,
          createdAt: ad.createdAt,
          reportToken: token,
        };
      })
    );

    return res.json({ ads: results });
  } catch (err) {
    req.log.error({ err }, "광고 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

// ─── 광고주 리포트 토큰 발급 / 조회 (관리자 전용) ─────────────────────────────────
router.post("/ads/:id/report-token", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다" });
  try {
    const { id } = req.params;
    const [ad] = await db.select().from(adsTable).where(eq(adsTable.id, id));
    if (!ad) return res.status(404).json({ error: "광고를 찾을 수 없습니다" });

    // 기존 토큰 있으면 재사용, 없으면 새로 발급
    const token = ad.reportToken ?? crypto.randomBytes(24).toString("base64url");

    if (!ad.reportToken) {
      await db.update(adsTable).set({ reportToken: token }).where(eq(adsTable.id, id));
    }

    req.log.info({ adId: id }, "광고 리포트 토큰 발급");
    return res.json({ token });
  } catch (err) {
    req.log.error({ err }, "리포트 토큰 발급 실패");
    return res.status(500).json({ error: "토큰 발급 실패" });
  }
});

// ─── 토큰 기반 광고주 공개 성과 리포트 ──────────────────────────────────────────
router.get("/public/report/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [ad] = await db.select().from(adsTable).where(eq(adsTable.reportToken, token));
    if (!ad || ad.status === "rejected") return res.status(404).json({ error: "리포트를 찾을 수 없습니다" });

    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(adPerformancesTable)
      .where(and(eq(adPerformancesTable.adId, ad.id), gte(adPerformancesTable.date, since)))
      .orderBy(adPerformancesTable.date);

    const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
    const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
    const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
    const ctr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;

    // 소속 풀의 예산 정보 조회
    const poolRow = rows[0]?.poolId
      ? (await db.select().from(adPoolsTable).where(eq(adPoolsTable.id, rows[0].poolId)))[0]
      : null;
    const totalBudget = poolRow?.totalBudget ?? 0;
    const budgetUsedPct = totalBudget > 0 ? Number(((totalSpend / totalBudget) * 100).toFixed(1)) : null;

    const byDate: Record<string, { impressions: number; clicks: number }> = {};
    for (const r of rows) {
      const d = r.date;
      if (!byDate[d]) byDate[d] = { impressions: 0, clicks: 0 };
      byDate[d].impressions += r.impressions;
      byDate[d].clicks += r.clicks;
    }
    const dailyChart = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, impressions: v.impressions, clicks: v.clicks }));

    return res.json({
      adTitle: ad.title,
      businessName: ad.businessName,
      status: ad.status,
      since,
      until,
      performance: { totalImpressions, totalClicks, totalSpend, ctr, totalBudget, budgetUsedPct },
      hasSufficientData: rows.length > 0,
      dailyChart,
    });
  } catch (err) {
    req.log.error({ err }, "공개 리포트 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

// ─── 광고주 공개 성과 요약 (인증 없음, adId 기반) ──────────────────────────────────
router.get("/public/ads/:id/performance-summary", async (req, res) => {
  try {
    const { id } = req.params;
    const [ad] = await db.select().from(adsTable).where(eq(adsTable.id, id));
    if (!ad || ad.status === "rejected") return res.status(404).json({ error: "광고를 찾을 수 없습니다" });

    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(adPerformancesTable)
      .where(and(eq(adPerformancesTable.adId, id), gte(adPerformancesTable.date, since)))
      .orderBy(adPerformancesTable.date);

    const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
    const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
    const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
    const ctr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;

    return res.json({
      adTitle: ad.title,
      businessName: ad.businessName,
      status: ad.status,
      since,
      until,
      performance: { totalImpressions, totalClicks, totalSpend, ctr },
      hasSufficientData: rows.length > 0,
    });
  } catch (err) {
    req.log.error({ err }, "광고주 성과 요약 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

export default router;
