#!/bin/bash
# PLAY강릉 핵심 API 검증 스크립트
# - 필수 검증 실패 시 exit 1
# - 관리자 로그인 curl 테스트는 참고용(경고만 출력, 실패 처리 안 함)

set -e

PASS=0
FAIL=0
WARN=0

pass() { echo "✅ $1"; PASS=$((PASS+1)); }
fail() { echo "❌ $1"; FAIL=$((FAIL+1)); }
warn() { echo "⚠️  $1"; WARN=$((WARN+1)); }

BASE="http://localhost:80"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PLAY강릉 API 검증"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. /api/feed JSON 200 ─────────────────────────────────
echo ""
echo "▶ [1] /api/feed JSON 응답"

FEED_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/feed")
FEED_CT=$(curl -s -o /dev/null -w '%{content_type}' "$BASE/api/feed")
FEED_BODY=$(curl -s "$BASE/api/feed")

if [ "$FEED_STATUS" != "200" ]; then
  fail "/api/feed HTTP $FEED_STATUS (200 기대)"
elif echo "$FEED_CT" | grep -q "text/html"; then
  fail "/api/feed Content-Type이 text/html — Clerk 또는 nginx 라우팅 문제"
elif ! echo "$FEED_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'feed' in d" 2>/dev/null; then
  fail "/api/feed 응답에 'feed' 키 없음 — 응답: ${FEED_BODY:0:100}"
else
  pass "/api/feed JSON 정상"
fi

# ── 2. API 응답에 HTML 없음 ───────────────────────────────
echo ""
echo "▶ [2] API HTML 응답 없음"

HTML_DETECTED=0
for ENDPOINT in "/api/feed" "/api/events"; do
  BODY=$(curl -s "$BASE$ENDPOINT")
  if echo "$BODY" | grep -q "DOCTYPE\|<html"; then
    fail "$ENDPOINT 에서 HTML 반환 감지"
    HTML_DETECTED=1
  fi
done

if [ "$HTML_DETECTED" -eq 0 ]; then
  pass "API HTML 응답 없음"
fi

# ── 3. Clerk 오류 없음 ────────────────────────────────────
echo ""
echo "▶ [3] Clerk 오류 검사"

CLERK_ERROR=0

# 3a. 로그인 POST가 HTML 반환 → Clerk 미들웨어 오류 의심
LOGIN_BODY=$(curl -s -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"password":"__clerk_test__"}')

if echo "$LOGIN_BODY" | grep -q "DOCTYPE\|<html"; then
  fail "로그인 API가 HTML 반환 — Clerk 미들웨어 오류 (Publishable key not valid 등)"
  CLERK_ERROR=1
elif echo "$LOGIN_BODY" | grep -qi "Publishable key not valid\|clerk.*error\|Invalid.*key"; then
  fail "로그인 API 응답에 Clerk 키 오류 메시지 감지: ${LOGIN_BODY:0:120}"
  CLERK_ERROR=1
fi

# 3b. pm2 최근 로그에서 Clerk 키 오류 감지 (pm2 있을 때만)
if command -v pm2 &>/dev/null; then
  PM2_LOG=$(pm2 logs --nostream --lines 50 2>/dev/null || true)
  if echo "$PM2_LOG" | grep -qi "Publishable key not valid\|clerk.*fatal\|Invalid publishable"; then
    fail "pm2 로그에서 Clerk 키 오류 감지"
    CLERK_ERROR=1
  fi
fi

if [ "$CLERK_ERROR" -eq 0 ]; then
  pass "Clerk 오류 없음"
fi

# ── 4. 관리자 로그인 (참고용 — 실패해도 전체 실패 처리 안 함) ──
echo ""
echo "▶ [4] 관리자 로그인 curl 테스트 (참고용)"

COOKIE_JAR=$(mktemp)
LOGIN_RESULT=$(curl -s -c "$COOKIE_JAR" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"password":"1235"}')
LOGIN_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"password":"1235"}')

if echo "$LOGIN_RESULT" | grep -q '"ok":true'; then
  pass "관리자 로그인 curl 성공 (password=1235)"
else
  warn "관리자 로그인 curl 테스트는 브라우저 세션 방식과 달라 참고용 (status=$LOGIN_STATUS)"
  COOKIE_JAR=""
fi

# ── 5. 인증 보호 엔드포인트 (필수) ───────────────────────
echo ""
echo "▶ [5] 인증 보호 엔드포인트"

AUTH_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$BASE/api/events/nonexistent/status" \
  -H 'Content-Type: application/json' -d '{"status":"approved"}')
if [ "$AUTH_STATUS" = "401" ]; then
  pass "미인증 PATCH /api/events/:id/status → 401"
else
  fail "미인증 PATCH /api/events/:id/status → $AUTH_STATUS (401 기대)"
fi

BULK_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/events/bulk" \
  -H 'Content-Type: application/json' -d '{"ids":[]}')
if [ "$BULK_STATUS" = "401" ]; then
  pass "미인증 DELETE /api/events/bulk → 401"
else
  fail "미인증 DELETE /api/events/bulk → $BULK_STATUS (401 기대)"
fi

# ── 6. 캐시 헤더 ─────────────────────────────────────────
echo ""
echo "▶ [6] 캐시 헤더"

CACHE_HEADER=$(curl -sI "$BASE/api/feed")
if echo "$CACHE_HEADER" | grep -qi "no-store"; then
  pass "/api/feed Cache-Control: no-store"
else
  fail "/api/feed Cache-Control 헤더에 no-store 없음"
fi

# ── 7. 인증 후 엔드포인트 (로그인 성공 시에만) ───────────
if [ -n "$COOKIE_JAR" ]; then
  echo ""
  echo "▶ [7] 인증 후 엔드포인트 (선택)"

  STATUS_404=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" \
    -X PATCH "$BASE/api/events/nonexistent/status" \
    -H 'Content-Type: application/json' -d '{"status":"approved"}')
  if [ "$STATUS_404" = "404" ]; then
    pass "인증 후 없는 ID PATCH → 404"
  else
    fail "인증 후 없는 ID PATCH → $STATUS_404 (404 기대)"
  fi

  BULK_400=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" \
    -X DELETE "$BASE/api/events/bulk" \
    -H 'Content-Type: application/json' -d '{"ids":[]}')
  if [ "$BULK_400" = "400" ]; then
    pass "인증 후 빈 배열 DELETE → 400"
  else
    fail "인증 후 빈 배열 DELETE → $BULK_400 (400 기대)"
  fi
fi

rm -f "$COOKIE_JAR"

# ── 최종 요약 ─────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  검증 결과"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -eq 0 ]; then
  echo "✅ 전체 핵심 검증 통과  (통과: $PASS  경고: $WARN  실패: $FAIL)"
else
  echo "❌ 핵심 검증 실패      (통과: $PASS  경고: $WARN  실패: $FAIL)"
fi

echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
