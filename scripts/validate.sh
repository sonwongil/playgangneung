#!/bin/bash
set -e

PASS=0
FAIL=0

check() {
  local name="$1"
  local cmd="$2"
  local expect="$3"
  printf "%-40s" "[$name]"
  result=$(eval "$cmd" 2>&1)
  if echo "$result" | grep -q "$expect"; then
    echo "✅ OK"
    PASS=$((PASS+1))
  else
    echo "❌ FAIL — $result"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "=== 관리자 로그인 ==="
COOKIE_JAR=$(mktemp)
LOGIN_RESULT=$(curl -s -c "$COOKIE_JAR" -X POST http://localhost:80/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"1235"}')
if echo "$LOGIN_RESULT" | grep -q '"success":true'; then
  echo "✅ 로그인 성공"
else
  echo "⚠️  로그인 실패 (비밀번호 변경됨) — 인증 필요 테스트 건너뜀"
  COOKIE_JAR=""
fi

echo ""
echo "=== API 엔드포인트 검증 ==="

check "/api/feed → feed 키 존재" \
  "curl -sf http://localhost:80/api/feed | python3 -c \"import json,sys; d=json.load(sys.stdin); print('feed' in d)\"" \
  "True"

check "/api/events → events 키 존재" \
  "curl -sf http://localhost:80/api/events | python3 -c \"import json,sys; d=json.load(sys.stdin); print('events' in d)\"" \
  "True"

check "/api/events/:id/status → 인증 없으면 401" \
  "curl -s -o /dev/null -w '%{http_code}' -X PATCH http://localhost:80/api/events/nonexistent/status -H 'Content-Type: application/json' -d '{\"status\":\"approved\"}'" \
  "401"

if [ -n "$COOKIE_JAR" ]; then
  check "/api/events/:id/status → 없는 ID는 404 (인증)" \
    "curl -s -o /dev/null -w '%{http_code}' -b \"$COOKIE_JAR\" -X PATCH http://localhost:80/api/events/nonexistent/status -H 'Content-Type: application/json' -d '{\"status\":\"approved\"}'" \
    "404"

  check "/api/events/bulk DELETE → 빈 배열 400 (인증)" \
    "curl -s -o /dev/null -w '%{http_code}' -b \"$COOKIE_JAR\" -X DELETE http://localhost:80/api/events/bulk -H 'Content-Type: application/json' -d '{\"ids\":[]}'" \
    "400"

  check "/api/proxy/download → URL 없으면 400 (인증)" \
    "curl -s -o /dev/null -w '%{http_code}' -b \"$COOKIE_JAR\" 'http://localhost:80/api/proxy/download'" \
    "400"
fi

check "/api/events/bulk DELETE → 인증 없으면 401" \
  "curl -s -o /dev/null -w '%{http_code}' -X DELETE http://localhost:80/api/events/bulk -H 'Content-Type: application/json' -d '{\"ids\":[]}'" \
  "401"

echo ""
echo "=== 캐시 헤더 검증 ==="

check "/api/feed Cache-Control: no-store" \
  "curl -sI http://localhost:80/api/feed" \
  "no-store"

rm -f "$COOKIE_JAR"

echo ""
echo "=== 결과 ==="
echo "통과: $PASS  실패: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
