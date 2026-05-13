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
echo "=== API 엔드포인트 검증 ==="

check "/api/feed → feed 키 존재" \
  "curl -sf http://localhost:80/api/feed | python3 -c \"import json,sys; d=json.load(sys.stdin); print('feed' in d)\"" \
  "True"

check "/api/events → events 키 존재" \
  "curl -sf http://localhost:80/api/events | python3 -c \"import json,sys; d=json.load(sys.stdin); print('events' in d)\"" \
  "True"

check "/api/events/:id/status → 없는 ID는 404" \
  "curl -s -o /dev/null -w '%{http_code}' -X PATCH http://localhost:80/api/events/nonexistent/status -H 'Content-Type: application/json' -d '{\"status\":\"approved\"}'" \
  "404"

check "/api/events/bulk DELETE → 빈 배열 400" \
  "curl -s -o /dev/null -w '%{http_code}' -X DELETE http://localhost:80/api/events/bulk -H 'Content-Type: application/json' -d '{\"ids\":[]}'" \
  "400"

check "/api/proxy/download → URL 없으면 400" \
  "curl -s -o /dev/null -w '%{http_code}' 'http://localhost:80/api/proxy/download'" \
  "400"

echo ""
echo "=== 캐시 헤더 검증 ==="

check "/api/feed Cache-Control: no-store" \
  "curl -sI http://localhost:80/api/feed" \
  "no-store"

echo ""
echo "=== 결과 ==="
echo "통과: $PASS  실패: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
