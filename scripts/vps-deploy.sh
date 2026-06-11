#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PLAY강릉 — Cafe24 VPS 배포 스크립트
#
# 사전 조건:
#   - Node.js 24 설치  (scripts/vps-first-setup.sh 참고)
#   - pnpm 설치        (npm install -g pnpm)
#   - PM2 설치         (npm install -g pm2)
#   - .env 파일 존재   (cp .env.example .env && vi .env)
#   - PostgreSQL 실행 중, DATABASE_URL 설정 완료
#
# 사용법:
#   ./scripts/vps-deploy.sh                  # 전체 배포 (DB migrate 포함)
#   ./scripts/vps-deploy.sh --frontend-only  # 프론트엔드만 (DB migrate 제외)
#   ./scripts/vps-deploy.sh -f               # 위와 동일
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set -e

# ── 옵션 파싱 ─────────────────────────────────────────────
FRONTEND_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --frontend-only|-f) FRONTEND_ONLY=true ;;
  esac
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FRONTEND_ONLY" = true ]; then
  echo "  PLAY강릉 VPS 배포 (프론트엔드 전용)"
else
  echo "  PLAY강릉 VPS 배포 (전체)"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 환경변수 로드 ─────────────────────────────────────────
if [ -f ".env" ]; then
  set -a; source .env; set +a
  echo "✅ .env 로드 완료"
else
  echo "❌ .env 파일이 없습니다. cp .env.example .env 후 값을 입력하세요."
  exit 1
fi

# ── 런타임 디렉토리 보호 (재clone/git clean 후에도 유지) ──
mkdir -p artifacts/api-server/data
mkdir -p artifacts/api-server/public/cards
mkdir -p artifacts/api-server/public/uploads
mkdir -p logs
echo "✅ 런타임 디렉토리 확인 완료"

# ── 의존성 설치 ───────────────────────────────────────────
echo ""
echo "▶ [1] 의존성 설치..."
pnpm install --frozen-lockfile
echo "✅ 완료"

# ── DB 마이그레이션 (--frontend-only 시 건너뜀) ───────────
if [ "$FRONTEND_ONLY" = true ]; then
  echo ""
  echo "▶ [2] DB 마이그레이션 — 건너뜀 (--frontend-only 모드)"
else
  echo ""
  echo "▶ [2] DB 마이그레이션 적용..."
  # drizzle-kit migrate: drizzle/ SQL 파일을 순서대로 적용 (안전)
  # push 절대 사용 금지 — 스키마에서 사라진 컬럼·테이블을 DROP할 수 있음
  #
  # 이미 적용된 마이그레이션이 있을 경우(relation already exists 등)
  # drizzle-kit migrate가 에러를 내도 배포가 중단되지 않도록 처리.
  # drizzle 마이그레이션 저널(__drizzle_migrations)이 실제 DB와 동기화되지
  # 않은 경우에도 기존 테이블·데이터는 절대 건드리지 않음.
  set +e
  MIGRATE_OUT=$(pnpm --filter @workspace/db run migrate 2>&1)
  MIGRATE_CODE=$?
  set -e

  if [ $MIGRATE_CODE -eq 0 ]; then
    echo "✅ DB 마이그레이션 완료"
  else
    # "already exists" 류 에러는 이미 반영된 것으로 간주하고 계속 진행
    if echo "$MIGRATE_OUT" | grep -qi "already exists\|already applied\|no migrations"; then
      echo "⚠️  DB 마이그레이션: 이미 적용된 상태 — 건너뜀"
      echo "   (필요 시 drizzle 마이그레이션 저널 동기화 필요)"
    else
      echo "❌ DB 마이그레이션 실패:"
      echo "$MIGRATE_OUT"
      exit 1
    fi
  fi
fi

# ── API 서버 빌드 ─────────────────────────────────────────
echo ""
echo "▶ [3] API 서버 빌드..."
NODE_ENV=production pnpm --filter @workspace/api-server run build
echo "✅ 완료"

# ── 프론트엔드 빌드 ───────────────────────────────────────
echo ""
echo "▶ [4] 프론트엔드 빌드..."

# 빌드 전 운영 환경변수 검증 (pk_live_ 키 필수)
bash "$(dirname "$0")/check-prod-env.sh" \
  "artifacts/playgangneung-dashboard/.env.production"

# Vite VITE_ 환경변수가 artifacts/playgangneung-dashboard/.env.production 에 있어야 함
NODE_ENV=production BASE_PATH=/ pnpm --filter @workspace/playgangneung-dashboard run build
echo "✅ 완료"

# ── PM2 재시작 ────────────────────────────────────────────
echo ""
echo "▶ [5] PM2 서버 재시작..."
mkdir -p logs

if pm2 describe playgangneung > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
  echo "✅ PM2 무중단 재시작 완료"
else
  pm2 start ecosystem.config.cjs
  pm2 save
  echo "✅ PM2 신규 시작 완료"
fi

# ── 검증 ──────────────────────────────────────────────────
echo ""
echo "▶ API 헬스체크..."
sleep 2
HEALTH=$(curl -sf http://localhost:8080/api/healthz 2>/dev/null || echo "FAIL")
if echo "$HEALTH" | grep -q "ok\|healthy\|true"; then
  echo "✅ 서버 정상 응답"
else
  echo "⚠️  헬스체크 실패 — pm2 logs playgangneung 으로 로그 확인"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  배포 완료!"
echo "  로그 확인: pm2 logs playgangneung"
echo "  상태 확인: pm2 status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
