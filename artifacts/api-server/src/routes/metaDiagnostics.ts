/**
 * GET /api/meta/diagnostics
 * Meta 토큰 권한·연결 상태 전체 진단 (토큰 원문 절대 미노출)
 */
import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { maskToken, getTokenSource } from "../lib/metaApi.js";

const GRAPH = "https://graph.facebook.com/v19.0";

const router = Router();

// ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

function getToken(): string | null {
  // metaApi.ts의 _tokenOverride 는 private 이므로 여기서는 환경변수만 직접 접근
  // (DB 오버라이드 토큰은 getTokenSource() 로 출처 확인만)
  return process.env["META_ACCESS_TOKEN"]?.trim() ?? null;
}

async function graphGet<T>(path: string, params: Record<string, string>, token: string): Promise<{ ok: true; data: T } | { ok: false; error: string; code?: number }> {
  try {
    const qs = new URLSearchParams({ ...params, access_token: token });
    const res = await fetch(`${GRAPH}/${path}?${qs}`);
    const json = await res.json() as Record<string, unknown>;
    if (!res.ok || json["error"]) {
      const err = json["error"] as Record<string, unknown> | undefined;
      return {
        ok   : false,
        error: (err?.["message"] as string) ?? JSON.stringify(json),
        code : (err?.["code"] as number) ?? res.status,
      };
    }
    return { ok: true, data: json as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "네트워크 오류" };
  }
}

// ─── 진단 엔드포인트 ───────────────────────────────────────────────────────────

router.get("/meta/diagnostics", requireAdmin, async (req, res) => {
  const token = getToken();
  const tokenSource = getTokenSource();
  const tokenMasked = maskToken(token ?? undefined);

  // ── 1. 토큰 기본 정보 ─────────────────────────────────────────────────────
  const tokenInfo: {
    configured: boolean;
    masked: string;
    source: string;
    valid?: boolean;
    userId?: string;
    userName?: string;
    error?: string;
  } = {
    configured: !!token,
    masked    : tokenMasked,
    source    : tokenSource,
  };

  if (!token) {
    return res.json({
      tokenInfo,
      scopes            : [],
      missingPermissions: ["META_ACCESS_TOKEN 환경변수 미설정"],
      facebookPublish   : { possible: false, reason: "토큰 없음" },
      instagramPublish  : { possible: false, reason: "토큰 없음" },
      nextSteps         : ["Meta Business Suite → 시스템 사용자 → 토큰 발급 후 Replit Secret META_ACCESS_TOKEN 에 저장"],
    });
  }

  // ── 2. /me 확인 ───────────────────────────────────────────────────────────
  const meResult = await graphGet<{ id: string; name: string }>("me", { fields: "id,name" }, token);
  if (!meResult.ok) {
    tokenInfo.valid = false;
    tokenInfo.error = meResult.error;
    return res.json({
      tokenInfo,
      scopes            : [],
      missingPermissions: ["토큰 자체가 유효하지 않음"],
      facebookPublish   : { possible: false, reason: `토큰 오류: ${meResult.error}` },
      instagramPublish  : { possible: false, reason: `토큰 오류: ${meResult.error}` },
      nextSteps         : ["Meta Business Suite에서 새 토큰 발급 후 교체"],
    });
  }
  tokenInfo.valid    = true;
  tokenInfo.userId   = meResult.data.id;
  tokenInfo.userName = meResult.data.name;

  // ── 3. 권한(scopes) 목록 ──────────────────────────────────────────────────
  const REQUIRED_FB_SCOPES = ["pages_read_engagement", "pages_manage_posts", "pages_show_list"];
  const REQUIRED_IG_SCOPES = ["instagram_basic", "instagram_content_publish"];

  let grantedScopes: string[] = [];
  let scopeError: string | null = null;

  const permResult = await graphGet<{ data: { permission: string; status: string }[] }>(
    "me/permissions", {}, token,
  );
  if (permResult.ok) {
    grantedScopes = permResult.data.data
      .filter(p => p.status === "granted")
      .map(p => p.permission);
  } else {
    scopeError = permResult.error;
  }

  const hasScope = (s: string) => grantedScopes.includes(s);

  // ── 4. /me/accounts (연결 페이지 목록) ────────────────────────────────────
  type AccountData = { data: { id: string; name: string; access_token?: string }[] };
  let pages: { id: string; name: string; access_token?: string }[] = [];
  let accountsError: string | null = null;
  let accountsCallable = false;

  const accountsResult = await graphGet<AccountData>("me/accounts", { fields: "id,name,access_token" }, token);
  if (accountsResult.ok) {
    accountsCallable = true;
    pages = accountsResult.data.data;
  } else {
    accountsError = accountsResult.error;
  }

  // ── 5. 설정된 페이지 ID 매칭 + 페이지 토큰 조회 ───────────────────────────
  const configuredPageId = process.env["META_PAGE_ID"]?.trim() ?? null;
  let pageTokenOk = false;
  let pageTokenError: string | null = null;
  let matchedPage: { id: string; name: string } | null = null;

  if (configuredPageId) {
    const matchFromAccounts = pages.find(p => p.id === configuredPageId);
    if (matchFromAccounts) {
      matchedPage = { id: matchFromAccounts.id, name: matchFromAccounts.name };
      pageTokenOk = !!matchFromAccounts.access_token;
      if (!pageTokenOk) pageTokenError = "access_token 필드 없음 (manage_pages 권한 필요)";
    } else {
      // 직접 호출 시도
      const pageResult = await graphGet<{ id: string; name: string; access_token?: string }>(
        configuredPageId, { fields: "id,name,access_token" }, token,
      );
      if (pageResult.ok) {
        matchedPage    = { id: pageResult.data.id, name: pageResult.data.name };
        pageTokenOk    = !!pageResult.data.access_token;
        if (!pageTokenOk) pageTokenError = "access_token 필드 없음";
      } else {
        pageTokenError = pageResult.error;
      }
    }
  }

  // ── 6. Instagram Business Account ID 조회 ────────────────────────────────
  const envIgId     = process.env["INSTAGRAM_BUSINESS_ACCOUNT_ID"]?.trim() ?? null;
  let discoveredIgId: string | null = null;
  let igIdError: string | null = null;

  if (configuredPageId) {
    const igResult = await graphGet<{ instagram_business_account?: { id: string } }>(
      configuredPageId,
      { fields: "instagram_business_account" },
      token,
    );
    if (igResult.ok) {
      discoveredIgId = igResult.data.instagram_business_account?.id ?? null;
      if (!discoveredIgId) igIdError = "페이지에 연결된 Instagram Business Account 없음";
    } else {
      igIdError = igResult.error;
    }
  }

  // ── 7. 권한 분석 및 결론 ──────────────────────────────────────────────────
  const missing: string[] = [];
  for (const s of [...REQUIRED_FB_SCOPES, ...REQUIRED_IG_SCOPES]) {
    if (!hasScope(s)) missing.push(s);
  }

  const fbCanPublish =
    hasScope("pages_manage_posts") &&
    hasScope("pages_read_engagement") &&
    !!configuredPageId;

  const igCanPublish =
    hasScope("instagram_content_publish") &&
    hasScope("instagram_basic") &&
    !!(envIgId ?? discoveredIgId);

  // ── 8. 다음 조치 ──────────────────────────────────────────────────────────
  const nextSteps: string[] = [];

  if (!fbCanPublish) {
    if (!hasScope("pages_manage_posts"))
      nextSteps.push("Meta Business Suite → 시스템 사용자 → 권한 편집 → pages_manage_posts 추가 (시스템 사용자에서 검색 안 될 경우, 아래 참고)");
    if (!hasScope("pages_read_engagement"))
      nextSteps.push("pages_read_engagement 권한 추가 필요");
    if (!configuredPageId)
      nextSteps.push("META_PAGE_ID 환경변수 설정 필요");
  }

  if (!igCanPublish) {
    if (!hasScope("instagram_content_publish"))
      nextSteps.push("instagram_content_publish 권한 추가 필요 (시스템 사용자에서 검색 안 될 경우 아래 참고)");
    if (!hasScope("instagram_basic"))
      nextSteps.push("instagram_basic 권한 추가 필요");
    if (!envIgId && !discoveredIgId)
      nextSteps.push(
        discoveredIgId
          ? `INSTAGRAM_BUSINESS_ACCOUNT_ID=${discoveredIgId} 를 Replit Secret에 저장`
          : "Meta Business Suite → 연결된 Instagram 계정 → 비즈니스 계정 ID 확인 후 INSTAGRAM_BUSINESS_ACCOUNT_ID Secret 저장",
      );
  }

  if (!accountsCallable && !hasScope("pages_show_list")) {
    nextSteps.push(
      "pages_show_list 권한이 없어 /me/accounts 호출 불가 — " +
      "시스템 사용자 대신 '관리자 계정 사용자 토큰(User Token)'으로 발급하거나, " +
      "Facebook for Developers에서 앱 검수(App Review)를 통해 pages_manage_posts 권한을 승인받아야 합니다",
    );
  }

  if (missing.includes("pages_manage_posts") || missing.includes("instagram_content_publish")) {
    nextSteps.push(
      "⚠️ 시스템 사용자 토큰에서 검색 안 되는 경우: 해당 권한은 '앱 검수(App Review)' 또는 " +
      "'비즈니스 검증' 없이 시스템 사용자에게 부여 불가능할 수 있습니다. " +
      "Meta Business Suite → 앱 → 앱 검수 → pages_manage_posts 요청 필요",
    );
  }

  req.log.info(
    { grantedScopes, fbCanPublish, igCanPublish, missing },
    "Meta diagnostics 실행",
  );

  return res.json({
    tokenInfo,
    scopes: {
      granted         : grantedScopes,
      scopeError,
      required_facebook: REQUIRED_FB_SCOPES,
      required_instagram: REQUIRED_IG_SCOPES,
      checklist: {
        pages_manage_posts       : hasScope("pages_manage_posts"),
        pages_read_engagement    : hasScope("pages_read_engagement"),
        pages_show_list          : hasScope("pages_show_list"),
        instagram_basic          : hasScope("instagram_basic"),
        instagram_content_publish: hasScope("instagram_content_publish"),
      },
    },
    pages: {
      accountsCallable,
      accountsError,
      configuredPageId,
      matchedPage,
      pageTokenOk,
      pageTokenError,
    },
    instagram: {
      envIgId           : envIgId ? "설정됨" : null,
      discoveredIgId    : discoveredIgId ?? null,
      igIdError,
      effectiveIgId     : envIgId ?? discoveredIgId ?? null,
    },
    facebookPublish: {
      possible: fbCanPublish,
      reason  : fbCanPublish
        ? "Facebook 페이지 게시 가능"
        : [
            !hasScope("pages_manage_posts") && "pages_manage_posts 권한 없음",
            !hasScope("pages_read_engagement") && "pages_read_engagement 권한 없음",
            !configuredPageId && "META_PAGE_ID 미설정",
          ].filter(Boolean).join(", "),
    },
    instagramPublish: {
      possible: igCanPublish,
      reason  : igCanPublish
        ? "Instagram 게시 가능"
        : [
            !hasScope("instagram_content_publish") && "instagram_content_publish 권한 없음",
            !hasScope("instagram_basic") && "instagram_basic 권한 없음",
            !(envIgId ?? discoveredIgId) && "INSTAGRAM_BUSINESS_ACCOUNT_ID 미설정",
          ].filter(Boolean).join(", "),
    },
    missingPermissions: missing,
    nextSteps,
  });
});

export default router;
