/**
 * Meta Marketing API v19 래퍼
 * 환경변수 META_ACCESS_TOKEN, META_AD_ACCOUNT_ID 필요
 * 미설정 시 graceful fallback — 각 함수는 { ok: false, error: "unconfigured" } 반환
 */
import { logger } from "./logger.js";

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

function getCredentials(): { token: string; adAccountId: string } | null {
  const token = process.env["META_ACCESS_TOKEN"];
  const adAccountId = process.env["META_AD_ACCOUNT_ID"];
  if (!token || !adAccountId) return null;
  return { token, adAccountId };
}

type MetaResult<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: number };

async function metaPost<T = Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
): Promise<MetaResult<T>> {
  const creds = getCredentials();
  if (!creds) return { ok: false, error: "META_ACCESS_TOKEN / META_AD_ACCOUNT_ID 환경변수가 설정되지 않았습니다" };
  try {
    const url = `${GRAPH_BASE}/${path}`;
    const form = new URLSearchParams();
    form.append("access_token", creds.token);
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
  objective: string; // OUTCOME_AWARENESS | OUTCOME_TRAFFIC | OUTCOME_ENGAGEMENT | OUTCOME_SALES
  status?: "ACTIVE" | "PAUSED";
  dailyBudget?: number; // 원 단위 (KRW cents → 나누기 100 필요)
  startTime?: string;
  stopTime?: string;
}

export async function createCampaign(opts: CreateCampaignOptions) {
  const creds = getCredentials();
  if (!creds) return { ok: false as const, error: "미설정" };
  const OBJECTIVE_MAP: Record<string, string> = {
    awareness: "OUTCOME_AWARENESS",
    traffic: "OUTCOME_TRAFFIC",
    engagement: "OUTCOME_ENGAGEMENT",
    conversion: "OUTCOME_SALES",
  };
  return metaPost<{ id: string }>(`act_${creds.adAccountId}/campaigns`, {
    name: opts.name,
    objective: OBJECTIVE_MAP[opts.objective] ?? "OUTCOME_AWARENESS",
    status: opts.status ?? "PAUSED",
    special_ad_categories: [],
  });
}

// ─── 광고세트 생성 ───────────────────────────────────────────────────────────────
export interface CreateAdSetOptions {
  name: string;
  campaignId: string;
  dailyBudget: number; // KRW 원 단위
  startTime: string; // ISO8601
  endTime: string;
  targeting?: Record<string, unknown>;
}

export async function createAdSet(opts: CreateAdSetOptions) {
  const creds = getCredentials();
  if (!creds) return { ok: false as const, error: "미설정" };
  return metaPost<{ id: string }>(`act_${creds.adAccountId}/adsets`, {
    name: opts.name,
    campaign_id: opts.campaignId,
    daily_budget: Math.max(opts.dailyBudget * 100, 100), // centavos (KRW × 100)
    start_time: opts.startTime,
    end_time: opts.endTime,
    billing_event: "IMPRESSIONS",
    optimization_goal: "REACH",
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
        link: opts.linkUrl ?? `https://play-gangneung-dashboard.replit.app`,
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

export async function getAdInsights(adId: string, since: string, until: string) {
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
