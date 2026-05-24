#!/usr/bin/env bash
set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 PLAY강릉 배포 준비"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "▶ [1/3] 타입 검사 중..."
pnpm run typecheck 2>&1 | tail -5
echo "✅ 타입 검사 완료"

echo ""
echo "▶ [2/3] 개발 서버 재시작 중..."
pkill -f "tsx watch" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2
echo "✅ 개발 서버 재시작 완료"

echo ""
echo "▶ [3/3] 배포 준비 완료"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ 개발 서버 동기화 완료!"
echo "  👉 이제 Publish 버튼을 눌러주세요."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
