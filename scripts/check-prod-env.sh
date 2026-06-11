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
#           ⚠️  satellite 키(clerk.playgangneung.com 인코딩)이면 경고 — VPS 운영 불가
#               VPS에서는 반드시 .clerk.accounts.dev 기반 표준 키를 사용해야 함
#               표준 키 획득: https://play-gangneung-dashboard.replit.app/sign-in
#               접속 → DevTools → Network → clerk 요청 URL에서 pk_live_ 확인
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
  # satellite 키 감지: pk_live_ 이후 부분을 base64 디코딩해서 도메인 확인
  # pk_live_XXXX → base64("https://clerk.playgangneung.com$$...") → VPS 사용 불가
  CLERK_DECODED=""
  if command -v python3 > /dev/null 2>&1; then
    CLERK_RAW="${CLERK_KEY#pk_live_}"
    # base64 패딩 보정 후 디코딩
    CLERK_DECODED=$(python3 -c "
import base64, sys
raw = sys.argv[1]
raw += '=' * (-len(raw) % 4)
try:
    print(base64.b64decode(raw).decode())
except Exception:
    pass
" "$CLERK_RAW" 2>/dev/null || true)
  fi

  if echo "$CLERK_DECODED" | grep -q "clerk\.playgangneung\.com"; then
    echo "  ⚠️  VITE_CLERK_PUBLISHABLE_KEY = ${CLERK_KEY:0:12}... (pk_live_ 형식이지만 satellite 키)"
    echo ""
    echo "  ❗ 이 키는 Replit Publish 시 자동 생성된 satellite 키입니다."
    echo "     키 내부에 clerk.playgangneung.com 이 인코딩되어 있으며,"
    echo "     clerk.playgangneung.com DNS CNAME이 없으면 VPS에서 Clerk JS 로드가 실패합니다."
    echo ""
    echo "  ✅ VPS 운영에는 표준 키(.clerk.accounts.dev 기반)를 사용해야 합니다."
    echo "     표준 키 확인: https://play-gangneung-dashboard.replit.app/sign-in"
    echo "     접속 → DevTools → Network → clerk 요청 URL에서 pk_live_ 값 복사"
    echo "     디코딩 결과에 .clerk.accounts.dev 포함 여부로 표준 키 확인"
    FAIL=$((FAIL+1))
  else
    pass "VITE_CLERK_PUBLISHABLE_KEY = ${CLERK_KEY:0:12}... (pk_live_✓, 표준 키)"
  fi
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
