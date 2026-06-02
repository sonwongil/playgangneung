/**
 * Meta Marketing API v19 래퍼
 * 환경변수 META_ACCESS_TOKEN, META_AD_ACCOUNT_ID 필요
 * 미설정 시 graceful fallback — 각 함수는 { ok: false, error: "unconfigured" } 반환
 */
import { logger } from "./logger.js";

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

// ── 토큰 캐시 (DB 저장 토큰 > 환경변수) ─────────────────────────────────────
let _tokenOverride: string | null = null;

/** 서버 시작 시 DB에서 토큰 로드 */
export async function loadMetaTokenFromDb(): Promise<void> {
  try {
    const { db, siteConfigTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(siteConfigTable).where(eq(siteConfigTable.key, "META_ACCESS_TOKEN")).limit(1);
    if (rows[0]?.value) {
      _tokenOverride = rows[0].value;
      logger.info("Meta 토큰 DB에서 로드 완료");
    }
  } catch (e) {
    logger.warn({ err: e }, "Meta 토큰 DB 로드 실패 — 환경변수 fallback");
  }
}

/** 관리자 UI에서 토큰 업데이트 시 메모리 캐시도 동기화 */
export function updateCachedToken(token: string | null): void {
  _tokenOverride = token;
  _pageTokenCache.clear(); // 토큰 교체 시 페이지 토큰 캐시 초기화
}

/** 토큰 만료/무효 오류 여부 판별 */
export function isTokenExpiredError(error: string, code?: number): boolean {
  if (code === 190 || code === 102 || code === 104) return true;
  const lower = error.toLowerCase();
  return (
    lower.includes("session has expired") ||
    lower.includes("error validating access token") ||
    lower.includes("invalid oauth") ||
    lower.includes("token has expired") ||
    lower.includes("access token")
  );
}

/** 사용자용 토큰 만료 안내 메시지 */
export const TOKEN_EXPIRED_USER_MSG =
  "Meta 연동 토큰이 만료되었습니다. 관리자 설정에서 Meta 계정을 다시 연결해 주세요.";

/** 현재 유효한 토큰으로 Graph API /me 호출하여 유효성 확인 */
export async function verifyMetaToken(token?: string): Promise<{ valid: boolean; error?: string }> {
  const t = token ?? (_tokenOverride ?? process.env["META_ACCESS_TOKEN"])?.trim();
  if (!t) return { valid: false, error: "토큰이 설정되지 않았습니다" };
  try {
    const qs = new URLSearchParams({ access_token: t, fields: "name,id" });
    const res = await fetch(`${GRAPH_BASE}/me?${qs}`);
    const json = await res.json() as Record<string, unknown>;
    if (!res.ok || json["error"]) {
      const err = json["error"] as Record<string, unknown> | undefined;
      const msg = (err?.["message"] as string) ?? "토큰 검증 실패";
      const code = (err?.["code"] as number) ?? res.status;
      return { valid: false, error: msg, ...(code ? { code } : {}) } as { valid: false; error: string };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "네트워크 오류" };
  }
}

function getCredentials(): { token: string; adAccountId: string } | null {
  const token = (_tokenOverride ?? process.env["META_ACCESS_TOKEN"])?.trim();
  const adAccountId = process.env["META_AD_ACCOUNT_ID"]?.trim();
  if (!token || !adAccountId) return null;
  return { token, adAccountId };
}

type MetaResult<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: number };

async function metaPost<T = Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
  tokenOverride?: string,
): Promise<MetaResult<T>> {
  const creds = getCredentials();
  if (!creds) return { ok: false, error: "META_ACCESS_TOKEN / META_AD_ACCOUNT_ID 환경변수가 설정되지 않았습니다" };
  try {
    const url = `${GRAPH_BASE}/${path}`;
    const form = new URLSearchParams();
    form.append("access_token", tokenOverride ?? creds.token);
    for (const [k, v] of Object.entries(body)) {
      form.append(k, typeof v === "string" ? v : JSON.stringify(v));
    }
    const res = await fetch(url, { method: "POST", body: form });
    const json = await res.json() as Record<string, unknown>;
    if (!res.ok || json["error"]) {
      const err = json["error"] as Record<string, unknown> | undefined;
      const msg = (err?.["message"] as string) ?? JSON.stringify(json);
      const code = (err?.["code"] as number) ?? res.status;
      logger.warn({ path, code, msg }, "Meta API 오류");
      return { ok: false, error: msg, code };
    }
    return { ok: true, data: json as T };
  } catch (err) {
    logger.error({ err, path }, "Meta API 네트워크 오류");
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── 페이지 액세스 토큰 교환 (User Token → Page Token) ──────────────────────────
const _pageTokenCache = new Map<string, string>();

async function getPageAccessToken(pageId: string): Promise<string | null> {
  if (_pageTokenCache.has(pageId)) return _pageTokenCache.get(pageId)!;
  const creds = getCredentials();
  if (!creds) return null;
  try {
    const qs = new URLSearchParams({ fields: "access_token", access_token: creds.token });
    const res = await fetch(`${GRAPH_BASE}/${pageId}?${qs}`);
    const json = await res.json() as Record<string, unknown>;
    const token = json["access_token"] as string | undefined;
    if (token) {
      _pageTokenCache.set(pageId, token);
      logger.info({ pageId }, "Page Access Token 교환 완료");
      return token;
    }
    const err = json["error"] as Record<string, unknown> | undefined;
    logger.warn({ pageId, err }, "Page Access Token 교환 실패 — User Token으로 fallback");
    return null;
  } catch (e) {
    logger.warn({ err: e, pageId }, "Page Access Token 교환 네트워크 오류 — User Token으로 fallback");
    return null;
  }
}

// ─── Rate limit 현황 저장 (메모리, 마지막 응답 기준) ─────────────────────────────
let _lastRateLimit: RateLimitStatus | null = null;
export function getLastRateLimit(): RateLimitStatus | null { return _lastRateLimit; }

async function metaGet<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string> = {},
): Promise<MetaResult<T>> {
  const creds = getCredentials();
  if (!creds) return { ok: false, error: "META_ACCESS_TOKEN / META_AD_ACCOUNT_ID 환경변수가 설정되지 않았습니다" };
  try {
    const qs = new URLSearchParams({ ...params, access_token: creds.token });
    const url = `${GRAPH_BASE}/${path}?${qs}`;
    const res = await fetch(url);
    // Rate limit 헤더 캡처
    const rlHeader = res.headers.get("x-business-use-case-usage") ?? res.headers.get("x-app-usage");
    if (rlHeader) {
      const parsed = parseRateLimitHeader(rlHeader);
      if (parsed) { _lastRateLimit = parsed; logger.debug({ rateLimit: parsed }, "Meta API rate limit 갱신"); }
    }
    const json = await res.json() as Record<string, unknown>;
    if (!res.ok || json["error"]) {
      const err = json["error"] as Record<string, unknown> | undefined;
      const msg = (err?.["message"] as string) ?? JSON.stringify(json);
      const code = (err?.["code"] as number) ?? res.status;
      // 17 = API rate limit exceeded
      if (code === 17 || code === 32) {
        logger.warn({ code, msg }, "Meta API rate limit 초과");
      }
      return { ok: false, error: msg, code };
    }
    return { ok: true, data: json as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── 캠페인 생성 ────────────────────────────────────────────────────────────────
export interface CreateCampaignOptions {
  name: string;
  objective: string;
  status?: "ACTIVE" | "PAUSED";
  startTime?: string;
  stopTime?: string;
}

// Meta Marketing API objective 매핑
// 화면 표시 값 → Meta API 공식 값
export const OBJECTIVE_MAP: Record<string, string> = {
  // 새 목표 (Meta 화면과 1:1 매핑)
  awareness:             "OUTCOME_AWARENESS",      // 페이지 방문 수 및 팔로워 늘리기
  messages:              "MESSAGES",               // 메시지 수신 늘리기
  post_engagement:       "POST_ENGAGEMENT",         // Facebook 콘텐츠 홍보하기
  instagram_engagement:  "POST_ENGAGEMENT",         // Instagram 콘텐츠 홍보하기
  page_likes:            "PAGE_LIKES",              // 페이지 좋아요 늘리기
  traffic:               "OUTCOME_TRAFFIC",         // 웹사이트 방문자 늘리기
  // 레거시 (기존 데이터 호환)
  engagement:            "POST_ENGAGEMENT",
  conversion:            "OUTCOME_SALES",
};

// objective별 Ad Set 최적화 설정
export const ADSET_OPTIMIZATION: Record<string, { optimization_goal: string; billing_event: string }> = {
  awareness:             { optimization_goal: "REACH",            billing_event: "IMPRESSIONS" },
  messages:              { optimization_goal: "REPLIES",          billing_event: "IMPRESSIONS" },
  post_engagement:       { optimization_goal: "POST_ENGAGEMENT",  billing_event: "IMPRESSIONS" },
  instagram_engagement:  { optimization_goal: "POST_ENGAGEMENT",  billing_event: "IMPRESSIONS" },
  page_likes:            { optimization_goal: "PAGE_LIKES",       billing_event: "IMPRESSIONS" },
  traffic:               { optimization_goal: "LINK_CLICKS",      billing_event: "LINK_CLICKS" },
  engagement:            { optimization_goal: "POST_ENGAGEMENT",  billing_event: "IMPRESSIONS" },
  conversion:            { optimization_goal: "OFFSITE_CONVERSIONS", billing_event: "IMPRESSIONS" },
};

export async function createCampaign(opts: CreateCampaignOptions) {
  const creds = getCredentials();
  if (!creds) return { ok: false as const, error: "미설정" };
  return metaPost<{ id: string }>(`act_${creds.adAccountId}/campaigns`, {
    name: opts.name,
    objective: OBJECTIVE_MAP[opts.objective] ?? "OUTCOME_AWARENESS",
    status: opts.status ?? "PAUSED",
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  });
}

// ─── 광고세트 생성 ───────────────────────────────────────────────────────────────
export interface CreateAdSetOptions {
  name: string;
  campaignId: string;
  dailyBudget: number; // KRW 원 단위 (Meta API는 KRW를 원 단위 그대로 수신, × 100 불필요)
  startTime: string; // ISO8601
  endTime: string;
  objective?: string; // optimization_goal 자동 결정용
  targeting?: Record<string, unknown>;
}

export async function createAdSet(opts: CreateAdSetOptions) {
  const creds = getCredentials();
  if (!creds) return { ok: false as const, error: "미설정" };
  const optGoal = ADSET_OPTIMIZATION[opts.objective ?? "awareness"] ?? { optimization_goal: "REACH", billing_event: "IMPRESSIONS" };
  return metaPost<{ id: string }>(`act_${creds.adAccountId}/adsets`, {
    name: opts.name,
    campaign_id: opts.campaignId,
    // KRW는 소수점 없는 통화 → Meta API에 원 단위 그대로 (USD의 cents와 달리 × 100 불필요)
    daily_budget: Math.max(opts.dailyBudget, 1000),
    start_time: opts.startTime,
    end_time: opts.endTime,
    billing_event: optGoal.billing_event,
    optimization_goal: optGoal.optimization_goal,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: opts.targeting ?? {
      geo_locations: { countries: ["KR"], cities: [{ key: "635526", radius: 50, distance_unit: "kilometer" }] },
      age_min: 18, age_max: 65,
    },
    status: "PAUSED",
  });
}

// ─── 광고 이미지 업로드 (Meta Image API) ─────────────────────────────────────────
/**
 * 이미지 URL을 Meta Image API에 업로드하고 image_hash를 반환합니다.
 * creative의 image_hash 필드에 사용됩니다.
 */
export async function uploadAdImage(imageUrl: string): Promise<MetaResult<{ hash: string; url: string }>> {
  const creds = getCredentials();
  if (!creds) return { ok: false, error: "META_ACCESS_TOKEN / META_AD_ACCOUNT_ID 환경변수가 설정되지 않았습니다" };
  const res = await metaPost<{ images: Record<string, { hash: string; url: string }> }>(
    `act_${creds.adAccountId}/adimages`,
    { url: imageUrl },
  );
  if (!res.ok) return res;
  // Meta는 { images: { original: { hash, url } } } 또는 { images: { "<filename>": { hash, url } } } 형식으로 반환
  const images = res.data.images;
  const firstKey = Object.keys(images ?? {})[0];
  const img = firstKey ? images[firstKey] : undefined;
  if (!img?.hash) {
    logger.warn({ imageUrl }, "Meta Image API 업로드 성공했으나 hash 없음");
    return { ok: false, error: "이미지 업로드 응답에 hash가 없습니다" };
  }
  logger.info({ imageUrl, hash: img.hash }, "Meta 이미지 업로드 완료");
  return { ok: true, data: { hash: img.hash, url: img.url } };
}

// ─── 광고 소재 생성 ──────────────────────────────────────────────────────────────
export interface CreateAdOptions {
  name: string;
  adSetId: string;
  pageId: string;
  title: string;
  body: string;
  /** imageHash: Meta Image API 업로드 후 받은 해시 (우선 사용) */
  imageHash?: string;
  /** imageUrl: imageHash 없을 때 picture URL로 직접 전달 (폴백) */
  imageUrl?: string;
  linkUrl?: string;
}

export async function createAd(opts: CreateAdOptions) {
  const creds = getCredentials();
  if (!creds) return { ok: false as const, error: "미설정" };

  // 이미지: image_hash 우선, 없으면 picture URL 폴백
  const imageField: Record<string, unknown> = opts.imageHash
    ? { image_hash: opts.imageHash }
    : opts.imageUrl
      ? { picture: opts.imageUrl }
      : {};

  const creative: Record<string, unknown> = {
    name: `${opts.name} 소재`,
    object_story_spec: {
      page_id: opts.pageId,
      link_data: {
        message: opts.body,
        name: opts.title,
        link: opts.linkUrl ?? (process.env["SITE_URL"] ?? "https://playgangneung.com"),
        call_to_action: { type: "LEARN_MORE" },
        ...imageField,
      },
    },
  };
  // 소재(Creative) 먼저 생성
  const creativeRes = await metaPost<{ id: string }>(`act_${creds.adAccountId}/adcreatives`, creative);
  if (!creativeRes.ok) return creativeRes;

  const creativeId = creativeRes.data.id;
  const adRes = await metaPost<{ id: string }>(`act_${creds.adAccountId}/ads`, {
    name: opts.name,
    adset_id: opts.adSetId,
    creative: { creative_id: creativeId },
    status: "PAUSED",
  });
  if (!adRes.ok) return adRes;

  return { ok: true, data: { id: adRes.data.id, creativeId } };
}

// ─── 성과 인사이트 조회 ──────────────────────────────────────────────────────────
export interface InsightRow {
  date_start: string;
  date_stop: string;
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  ctr: string;
  cpc: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
}

export async function getCampaignInsights(campaignId: string, datePreset = "last_7d") {
  return metaGet<{ data: InsightRow[] }>(
    `${campaignId}/insights`,
    {
      fields: "impressions,clicks,spend,reach,ctr,cpc,date_start,date_stop",
      date_preset: datePreset,
      time_increment: "1",
      level: "campaign",
    },
  );
}

export async function getAdInsightsLegacy(adId: string, since: string, until: string) {
  return metaGet<{ data: InsightRow[] }>(
    `${adId}/insights`,
    {
      fields: "impressions,clicks,spend,reach,ctr,cpc,date_start,date_stop",
      time_range: JSON.stringify({ since, until }),
      time_increment: "1",
      level: "ad",
    },
  );
}

// ─── Rate limit 상태 확인 (Usage header 파싱) ────────────────────────────────────
export interface RateLimitStatus {
  callCount: number;
  totalCputime: number;
  totalTime: number;
  type: string;
  estimatedTimeToRegain: number;
}

export function parseRateLimitHeader(header: string | null): RateLimitStatus | null {
  if (!header) return null;
  try {
    // Meta 헤더는 항상 JSON 형식
    // x-app-usage: {"call_count":10,"total_cputime":2,"total_time":5}
    // x-business-use-case-usage: {"act_xxx":[{"call_count":10,...,"type":"ads_management"}]}
    const parsed = JSON.parse(header) as Record<string, unknown>;

    // x-app-usage (flat object)
    if (typeof parsed["call_count"] === "number") {
      return {
        callCount: Number(parsed["call_count"] ?? 0),
        totalCputime: Number(parsed["total_cputime"] ?? 0),
        totalTime: Number(parsed["total_time"] ?? 0),
        type: "app",
        estimatedTimeToRegain: Number(parsed["estimated_time_to_regain_access"] ?? 0),
      };
    }

    // x-business-use-case-usage (nested: {"act_xxx": [{...}]})
    const firstKey = Object.keys(parsed)[0];
    if (firstKey) {
      const arr = parsed[firstKey] as Array<Record<string, unknown>>;
      const item = (Array.isArray(arr) ? arr[0] : {}) as Record<string, unknown>;
      return {
        callCount: Number(item["call_count"] ?? 0),
        totalCputime: Number(item["total_cputime"] ?? 0),
        totalTime: Number(item["total_time"] ?? 0),
        type: String(item["type"] ?? ""),
        estimatedTimeToRegain: Number(item["estimated_time_to_regain_access"] ?? 0),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function isConfigured(): boolean {
  return !!(process.env["META_ACCESS_TOKEN"] && process.env["META_AD_ACCOUNT_ID"]);
}

// ─── 광고계정 오늘 지출 + amount_spent/spend_cap ─────────────────────────────────
export interface AccountSpendData {
  todaySpend: number;
  amountSpent: number | null;
  spendCap: number | null;
  currency: string;
}

export async function getAccountSpend(): Promise<{ ok: true; data: AccountSpendData } | { ok: false; error: string }> {
  const creds = getCredentials();
  if (!creds) return { ok: false, error: "META_ACCESS_TOKEN / META_AD_ACCOUNT_ID 환경변수가 설정되지 않았습니다" };

  const [insightsRes, accountRes] = await Promise.all([
    metaGet<{ data: Array<{ spend: string; impressions: string; clicks: string }> }>(
      `act_${creds.adAccountId}/insights`,
      { fields: "spend,impressions,clicks", date_preset: "today", level: "account" },
    ),
    metaGet<{ amount_spent: string; spend_cap: string; currency: string }>(
      `act_${creds.adAccountId}`,
      { fields: "amount_spent,spend_cap,currency" },
    ),
  ]);

  const todaySpend = insightsRes.ok ? Number(insightsRes.data.data?.[0]?.spend ?? 0) : 0;
  const amountSpent = accountRes.ok && accountRes.data.amount_spent ? Number(accountRes.data.amount_spent) / 100 : null;
  const spendCap = accountRes.ok && accountRes.data.spend_cap && accountRes.data.spend_cap !== "0"
    ? Number(accountRes.data.spend_cap) / 100
    : null;
  const currency = accountRes.ok ? (accountRes.data.currency ?? "KRW") : "KRW";

  return { ok: true, data: { todaySpend, amountSpent, spendCap, currency } };
}

// ─── 캠페인 목록 + 오늘 지출 ────────────────────────────────────────────────────
export interface CampaignSpendRow {
  id: string;
  name: string;
  status: string;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  todaySpend: number;
  impressions: number;
  clicks: number;
  reach: number;
}

export async function getCampaignsWithSpend(): Promise<{ ok: true; data: { campaigns: CampaignSpendRow[] } } | { ok: false; error: string }> {
  const creds = getCredentials();
  if (!creds) return { ok: false, error: "META_ACCESS_TOKEN / META_AD_ACCOUNT_ID 환경변수가 설정되지 않았습니다" };

  const [campaignsRes, insightsRes] = await Promise.all([
    metaGet<{ data: Array<{ id: string; name: string; status: string; daily_budget?: string; lifetime_budget?: string }> }>(
      `act_${creds.adAccountId}/campaigns`,
      { fields: "id,name,status,daily_budget,lifetime_budget", limit: "50" },
    ),
    metaGet<{ data: Array<{ campaign_id: string; spend: string; impressions: string; clicks: string; reach: string }> }>(
      `act_${creds.adAccountId}/insights`,
      { fields: "campaign_id,spend,impressions,clicks,reach", date_preset: "today", level: "campaign", limit: "50" },
    ),
  ]);

  if (!campaignsRes.ok) return campaignsRes;

  const insightMap = new Map<string, { spend: number; impressions: number; clicks: number; reach: number }>();
  if (insightsRes.ok) {
    for (const row of insightsRes.data.data ?? []) {
      insightMap.set(row.campaign_id, {
        spend: Number(row.spend ?? 0),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        reach: Number(row.reach ?? 0),
      });
    }
  }

  const campaigns: CampaignSpendRow[] = (campaignsRes.data.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
    lifetimeBudget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
    todaySpend: insightMap.get(c.id)?.spend ?? 0,
    impressions: insightMap.get(c.id)?.impressions ?? 0,
    clicks: insightMap.get(c.id)?.clicks ?? 0,
    reach: insightMap.get(c.id)?.reach ?? 0,
  }));

  return { ok: true, data: { campaigns } };
}

// ─── 광고세트 목록 + 오늘 지출 ──────────────────────────────────────────────────
export interface AdSetSpendRow {
  id: string;
  name: string;
  status: string;
  dailyBudget: number | null;
  todaySpend: number;
  impressions: number;
  clicks: number;
}

export async function getAdSetsWithSpend(campaignId: string): Promise<{ ok: true; data: { adsets: AdSetSpendRow[] } } | { ok: false; error: string }> {
  const [adsetsRes, insightsRes] = await Promise.all([
    metaGet<{ data: Array<{ id: string; name: string; status: string; daily_budget?: string }> }>(
      `${campaignId}/adsets`,
      { fields: "id,name,status,daily_budget", limit: "50" },
    ),
    metaGet<{ data: Array<{ adset_id: string; spend: string; impressions: string; clicks: string }> }>(
      `${campaignId}/insights`,
      { fields: "adset_id,spend,impressions,clicks", date_preset: "today", level: "adset", limit: "50" },
    ),
  ]);

  if (!adsetsRes.ok) return adsetsRes;

  const insightMap = new Map<string, { spend: number; impressions: number; clicks: number }>();
  if (insightsRes.ok) {
    for (const row of insightsRes.data.data ?? []) {
      insightMap.set(row.adset_id, {
        spend: Number(row.spend ?? 0),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
      });
    }
  }

  const adsets: AdSetSpendRow[] = (adsetsRes.data.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    dailyBudget: a.daily_budget ? Number(a.daily_budget) / 100 : null,
    todaySpend: insightMap.get(a.id)?.spend ?? 0,
    impressions: insightMap.get(a.id)?.impressions ?? 0,
    clicks: insightMap.get(a.id)?.clicks ?? 0,
  }));

  return { ok: true, data: { adsets } };
}

// ─── 광고 목록 + 오늘 지출 ──────────────────────────────────────────────────────
export interface AdSpendRow {
  id: string;
  name: string;
  status: string;
  todaySpend: number;
  impressions: number;
  clicks: number;
}

export async function getAdsWithSpend(campaignId: string): Promise<{ ok: true; data: { ads: AdSpendRow[] } } | { ok: false; error: string }> {
  const [adsRes, insightsRes] = await Promise.all([
    metaGet<{ data: Array<{ id: string; name: string; status: string }> }>(
      `${campaignId}/ads`,
      { fields: "id,name,status", limit: "50" },
    ),
    metaGet<{ data: Array<{ ad_id: string; spend: string; impressions: string; clicks: string }> }>(
      `${campaignId}/insights`,
      { fields: "ad_id,spend,impressions,clicks", date_preset: "today", level: "ad", limit: "50" },
    ),
  ]);

  if (!adsRes.ok) return adsRes;

  const insightMap = new Map<string, { spend: number; impressions: number; clicks: number }>();
  if (insightsRes.ok) {
    for (const row of insightsRes.data.data ?? []) {
      insightMap.set(row.ad_id, {
        spend: Number(row.spend ?? 0),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
      });
    }
  }

  const ads: AdSpendRow[] = (adsRes.data.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    todaySpend: insightMap.get(a.id)?.spend ?? 0,
    impressions: insightMap.get(a.id)?.impressions ?? 0,
    clicks: insightMap.get(a.id)?.clicks ?? 0,
  }));

  return { ok: true, data: { ads } };
}

// ─── 광고 effective_status / 검수 피드백 조회 ────────────────────────────────────
export interface AdStatusResult {
  id: string;
  name: string;
  /** Meta effective_status: ACTIVE | PAUSED | DISAPPROVED | PENDING_REVIEW | IN_REVIEW | WITH_ISSUES | ARCHIVED */
  effective_status: string;
  ad_review_feedback?: Record<string, unknown>;
}

export async function getAdEffectiveStatus(adId: string): Promise<MetaResult<AdStatusResult>> {
  return metaGet<AdStatusResult>(adId, { fields: "id,name,effective_status,ad_review_feedback" });
}

// ─── 캠페인/광고세트 상태 변경 (ACTIVE/PAUSED) ──────────────────────────────────
export async function updateCampaignStatus(campaignId: string, status: "ACTIVE" | "PAUSED") {
  return metaPost<{ success: boolean }>(`${campaignId}`, { status });
}

export async function updateAdSetStatus(adSetId: string, status: "ACTIVE" | "PAUSED") {
  return metaPost<{ success: boolean }>(`${adSetId}`, { status });
}

export async function updateAdStatus(adId: string, status: "ACTIVE" | "PAUSED") {
  return metaPost<{ success: boolean }>(`${adId}`, { status });
}

// ─── 광고별 Insights (CTR/CPC/Frequency 포함) ────────────────────────────────────
export interface AdInsightRow {
  adId: string;
  adName: string;
  adSetId: string;
  adSetName: string;
  campaignId: string;
  campaignName: string;
  dateStart: string;
  dateStop: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  frequency: number | null;
  ctr: number | null;
  cpc: number | null;
  cpp: number | null;
  status: string;
}

export async function getAdInsights(
  datePreset: "today" | "yesterday" | "last_7d" | "last_30d" = "today",
): Promise<MetaResult<{ insights: AdInsightRow[] }>> {
  const creds = getCredentials();
  if (!creds) return { ok: false, error: "META_ACCESS_TOKEN / META_AD_ACCOUNT_ID 환경변수가 설정되지 않았습니다" };

  const fields = [
    "ad_id", "ad_name",
    "adset_id", "adset_name",
    "campaign_id", "campaign_name",
    "date_start", "date_stop",
    "impressions", "clicks", "spend", "reach",
    "frequency", "ctr", "cpc", "cpp",
  ].join(",");

  const [insightsRes, adsRes] = await Promise.all([
    metaGet<{ data: Array<Record<string, string>> }>(
      `act_${creds.adAccountId}/insights`,
      { fields, date_preset: datePreset, level: "ad", limit: "200" },
    ),
    metaGet<{ data: Array<{ id: string; name: string; status: string }> }>(
      `act_${creds.adAccountId}/ads`,
      { fields: "id,name,status", limit: "200" },
    ),
  ]);

  if (!insightsRes.ok) return insightsRes;

  const statusMap = new Map<string, string>();
  if (adsRes.ok) {
    for (const a of adsRes.data.data ?? []) statusMap.set(a.id, a.status);
  }

  const insights: AdInsightRow[] = (insightsRes.data.data ?? []).map((r) => ({
    adId: r["ad_id"] ?? "",
    adName: r["ad_name"] ?? "",
    adSetId: r["adset_id"] ?? "",
    adSetName: r["adset_name"] ?? "",
    campaignId: r["campaign_id"] ?? "",
    campaignName: r["campaign_name"] ?? "",
    dateStart: r["date_start"] ?? "",
    dateStop: r["date_stop"] ?? "",
    impressions: Number(r["impressions"] ?? 0),
    clicks: Number(r["clicks"] ?? 0),
    spend: Number(r["spend"] ?? 0),
    reach: Number(r["reach"] ?? 0),
    frequency: r["frequency"] != null ? Number(r["frequency"]) : null,
    ctr: r["ctr"] != null ? Number(r["ctr"]) : null,
    cpc: r["cpc"] != null ? Number(r["cpc"]) : null,
    cpp: r["cpp"] != null ? Number(r["cpp"]) : null,
    status: statusMap.get(r["ad_id"] ?? "") ?? "UNKNOWN",
  }));

  return { ok: true, data: { insights } };
}

// ─── 페이지 게시물 ────────────────────────────────────────────────────────────

/** 이미지를 페이지에 임시 업로드 (published=false) → photo id 반환 */
export async function uploadPagePhoto(
  pageId: string,
  imageUrl: string,
  caption = "",
): Promise<MetaResult<{ id: string }>> {
  const pageToken = await getPageAccessToken(pageId);
  return metaPost<{ id: string }>(
    `${pageId}/photos`,
    { url: imageUrl, caption, published: "false" },
    pageToken ?? undefined,
  );
}

/** 여러 사진 id를 붙여 페이지에 게시물 생성 */
export async function createPageCarouselPost(
  pageId: string,
  message: string,
  photoIds: string[],
): Promise<MetaResult<{ id: string }>> {
  const pageToken = await getPageAccessToken(pageId);
  const body: Record<string, unknown> = { message };
  photoIds.forEach((id, i) => {
    body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
  });
  return metaPost<{ id: string }>(`${pageId}/feed`, body, pageToken ?? undefined);
}
