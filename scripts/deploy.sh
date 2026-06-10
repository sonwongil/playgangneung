#!/usr/bin/env bash
set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 PLAY강릉 배포 준비"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "▶ [1/4] 타입 검사 중..."
pnpm --filter @workspace/api-server run typecheck 2>&1 | tail -5
pnpm --filter @workspace/playgangneung-dashboard run typecheck 2>&1 | tail -5
echo "✅ 타입 검사 완료"

echo ""
echo "▶ [2/4] 프론트엔드 프로덕션 빌드 중..."
echo "    (Workbox SW + manifest.webmanifest 생성)"

# .env.production 파일이 있으면 운영 키 검증 수행
if [ -f "artifacts/playgangneung-dashboard/.env.production" ]; then
  bash "$(dirname "$0")/check-prod-env.sh" \
    "artifacts/playgangneung-dashboard/.env.production"
fi

PORT=22508 BASE_PATH=/ NODE_ENV=production \
  pnpm --filter @workspace/playgangneung-dashboard run build 2>&1 | tail -15
echo "✅ 프론트엔드 빌드 완료"

echo ""
echo "▶ [3/4] 빌드 산출물 검증..."
SW_FILE="artifacts/playgangneung-dashboard/dist/public/sw.js"
MANIFEST_FILE="artifacts/playgangneung-dashboard/dist/public/manifest.webmanifest"

if grep -q "workbox\|precacheAndRoute" "$SW_FILE" 2>/dev/null; then
  echo "  ✅ sw.js: Workbox precache 포함 확인"
else
  echo "  ❌ sw.js: Workbox 코드 없음 — 빌드 오류 확인 필요"
  exit 1
fi

if [ -f "$MANIFEST_FILE" ]; then
  echo "  ✅ manifest.webmanifest: 파일 존재"
else
  echo "  ❌ manifest.webmanifest: 없음 — VitePWA 설정 확인 필요"
  exit 1
fi

echo ""
echo "▶ [4/4] 개발 서버 재시작 중..."
pkill -f "tsx watch" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2
echo "✅ 개발 서버 재시작 완료"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ 배포 준비 완료!"
echo ""
echo "  검증:"
echo "    dist/public/sw.js            ✅ Workbox SW"
echo "    dist/public/manifest.webmanifest ✅ PWA 매니페스트"
echo ""
echo "  👉 이제 Publish 버튼을 눌러주세요."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
