#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# scripts/check-prod-env.sh
#
# 프론트엔드 프로덕션 빌드 전 필수 환경변수 검증
#
# 사용법:
#   ./scripts/check-prod-env.sh [ENV_FILE]
#   ENV_FILE 기본값: artifacts/playgangneung-dashboard/.env.production
#
# 검사 항목:
#   [필수] VITE_CLERK_PUBLISHABLE_KEY — pk_live_... 형식
#           pk_test_, pk_live_REPLACE_ME, 빈 값이면 즉시 실패
#   [조건] VITE_TOSS_CLIENT_KEY      — VITE_ENABLE_TOSS_PAYMENT=true 일 때
#           test_ck_, live_ck_REPLACE_ME, 빈 값이면 즉시 실패
#
# 보안 규칙:
#   - 이 스크립트는 공개 키(pk_live_, live_ck_)만 검사합니다.
#   - CLERK_SECRET_KEY (sk_live_...) 또는 서버 비밀키는 절대 확인하지 않습니다.
#   - .env.production 경로는 .gitignore에 포함되어야 하며 GitHub에 커밋하지 마세요.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set -e

ENV_FILE="${1:-artifacts/playgangneung-dashboard/.env.production}"

PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  프론트엔드 프로덕션 환경변수 검증"
if [ -f "$ENV_FILE" ]; then
  echo "  파일: $ENV_FILE"
else
  echo "  파일: $ENV_FILE (없음 — 현재 환경변수 사용)"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 환경변수 파일 로드 ─────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# ── 1. VITE_CLERK_PUBLISHABLE_KEY ────────────────────────
echo ""
echo "▶ [1] VITE_CLERK_PUBLISHABLE_KEY"
CLERK_KEY="${VITE_CLERK_PUBLISHABLE_KEY:-}"

if [ -z "$CLERK_KEY" ]; then
  fail "VITE_CLERK_PUBLISHABLE_KEY 미설정 — .env.production에 pk_live_... 값을 입력하세요"
elif [ "$CLERK_KEY" = "pk_live_REPLACE_ME" ]; then
  fail "VITE_CLERK_PUBLISHABLE_KEY가 플레이스홀더(pk_live_REPLACE_ME)입니다 — 실제 운영 키로 교체하세요"
elif echo "$CLERK_KEY" | grep -q "^pk_test_"; then
  fail "VITE_CLERK_PUBLISHABLE_KEY가 개발 키(pk_test_...)입니다 — 운영 키(pk_live_...)를 사용하세요
       ⚠️  개발 키는 Replit 개발 환경 전용입니다. VPS 운영 빌드에서는 반드시 pk_live_ 키가 필요합니다."
elif echo "$CLERK_KEY" | grep -q "^pk_live_"; then
  pass "VITE_CLERK_PUBLISHABLE_KEY = ${CLERK_KEY:0:12}... (pk_live_✓)"
else
  fail "VITE_CLERK_PUBLISHABLE_KEY 형식 오류: '${CLERK_KEY:0:20}...' — pk_live_로 시작해야 합니다"
fi

# ── 2. VITE_TOSS_CLIENT_KEY (결제 활성화 시 필수) ─────────
echo ""
echo "▶ [2] VITE_TOSS_CLIENT_KEY (VITE_ENABLE_TOSS_PAYMENT=${VITE_ENABLE_TOSS_PAYMENT:-false})"
TOSS_KEY="${VITE_TOSS_CLIENT_KEY:-}"
TOSS_ENABLED="${VITE_ENABLE_TOSS_PAYMENT:-false}"

if [ "$TOSS_ENABLED" = "true" ]; then
  if [ -z "$TOSS_KEY" ]; then
    fail "VITE_ENABLE_TOSS_PAYMENT=true 이지만 VITE_TOSS_CLIENT_KEY 미설정 — live_ck_... 값을 입력하세요"
  elif [ "$TOSS_KEY" = "live_ck_REPLACE_ME" ]; then
    fail "VITE_TOSS_CLIENT_KEY가 플레이스홀더(live_ck_REPLACE_ME)입니다 — 실제 운영 키로 교체하세요"
  elif echo "$TOSS_KEY" | grep -q "^test_ck_"; then
    fail "VITE_TOSS_CLIENT_KEY가 테스트 키(test_ck_...)입니다 — 운영 키(live_ck_...)를 사용하세요"
  elif echo "$TOSS_KEY" | grep -q "^live_ck_"; then
    pass "VITE_TOSS_CLIENT_KEY = ${TOSS_KEY:0:12}... (live_ck_✓)"
  else
    fail "VITE_TOSS_CLIENT_KEY 형식 오류: '${TOSS_KEY:0:20}...' — live_ck_로 시작해야 합니다"
  fi
else
  pass "VITE_ENABLE_TOSS_PAYMENT=false — 결제 비활성화, TOSS 키 검증 건너뜀"
fi

# ── 결과 ─────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FAIL" -eq 0 ]; then
  echo "  ✅ 환경변수 검증 통과 (통과: $PASS  실패: $FAIL)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  exit 0
else
  echo "  ❌ 환경변수 검증 실패 (통과: $PASS  실패: $FAIL)"
  echo ""
  echo "  해결 방법:"
  echo "    1. Clerk 운영 Publishable Key 확인:"
  echo "       - Replit 게시(Publish) 후 배포된 앱에서 확인"
  echo "       - 또는 Replit Auth 패널에서 확인"
  echo "    2. VPS 파일 수정:"
  echo "       vi /var/www/playgangneung/artifacts/playgangneung-dashboard/.env.production"
  echo "    3. 올바른 형식:"
  echo "       VITE_CLERK_PUBLISHABLE_KEY=pk_live_실제키..."
  echo "       VITE_CLERK_PROXY_URL="
  echo "    4. 수정 후 반드시 다시 빌드:"
  echo "       ./scripts/vps-deploy.sh"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  exit 1
fi
