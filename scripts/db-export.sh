#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PLAY강릉 — Replit DB 내보내기 스크립트
#
# 목적:
#   Replit PostgreSQL 데이터를 VPS로 이전하기 위한 덤프 파일 생성
#
# 사용법:
#   bash scripts/db-export.sh
#   bash scripts/db-export.sh --dry-run   (실제 실행 없이 확인만)
#
# 출력:
#   backups/replit-export-YYYY-MM-DD.sql.gz
#
# 이후 단계:
#   1. scp backups/replit-export-YYYY-MM-DD.sql.gz user@VPS_IP:/tmp/
#   2. VPS에서: gunzip -c /tmp/replit-export-YYYY-MM-DD.sql.gz | psql $DATABASE_URL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set -euo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$WORKSPACE_ROOT/backups"
DATE=$(TZ="Asia/Seoul" date +%Y-%m-%d_%H%M)
OUT_FILE="$BACKUP_DIR/replit-export-${DATE}.sql.gz"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PLAY강릉 DB 내보내기 (Replit → VPS)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 사전 확인 ────────────────────────────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL 환경변수가 설정되지 않았습니다."
  echo "   Replit 환경에서 실행 중인지 확인하세요."
  exit 1
fi

if ! command -v pg_dump &>/dev/null; then
  echo "❌ pg_dump 명령어를 찾을 수 없습니다."
  echo "   PostgreSQL 클라이언트 설치 필요: apt-get install -y postgresql-client"
  exit 1
fi

# ── 안전 안내 ────────────────────────────────────────────────────────────────
echo "⚠️  이 스크립트는 현재 Replit DB를 읽기 전용으로 덤프합니다."
echo "   원본 DB에는 아무런 변경을 가하지 않습니다."
echo ""
echo "  덤프 소스: ${DATABASE_URL%%@*}@**** (호스트 마스킹)"
echo "  출력 파일: $OUT_FILE"
echo ""

if [ "$DRY_RUN" -eq 1 ]; then
  echo "  [dry-run 모드] 실제 덤프 없이 확인만 합니다."
  echo ""
fi

# ── 확인 프롬프트 ─────────────────────────────────────────────────────────────
if [ "$DRY_RUN" -eq 0 ]; then
  read -r -p "계속 진행하시겠습니까? (yes/no): " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    echo "취소됐습니다."
    exit 0
  fi
fi

mkdir -p "$BACKUP_DIR"

# ── pg_dump 실행 ─────────────────────────────────────────────────────────────
echo ""
echo "▶ DB 덤프 시작..."

if [ "$DRY_RUN" -eq 1 ]; then
  echo "  [dry-run] pg_dump \"$DATABASE_URL\" | gzip > $OUT_FILE"
  echo "  ✅ dry-run 완료 — 실제 파일은 생성되지 않았습니다."
else
  TMP_FILE="${OUT_FILE}.tmp"

  # --no-owner --no-acl: VPS에서 다른 DB 사용자로 복원할 때 권한 충돌 방지
  if pg_dump \
      --no-owner \
      --no-acl \
      --clean \
      --if-exists \
      "$DATABASE_URL" 2>/dev/null \
      | gzip -9 > "$TMP_FILE"; then
    mv "$TMP_FILE" "$OUT_FILE"
    SIZE=$(du -sh "$OUT_FILE" | cut -f1)
    echo "  ✅ 완료: $(basename "$OUT_FILE") ($SIZE)"
  else
    rm -f "$TMP_FILE"
    echo "  ❌ pg_dump 실패 — DATABASE_URL 연결을 확인하세요."
    exit 1
  fi
fi

# ── 다음 단계 안내 ────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  다음 단계 (VPS로 이전)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1. 덤프 파일을 VPS로 전송:"
echo "     scp $OUT_FILE user@VPS_IP:/tmp/"
echo ""
echo "  2. VPS에서 복원 (PostgreSQL DB가 생성된 상태여야 함):"
echo "     gunzip -c /tmp/$(basename "$OUT_FILE") | psql \$DATABASE_URL"
echo ""
echo "  3. 복원 확인:"
echo "     psql \$DATABASE_URL -c '\\dt'   (테이블 목록 확인)"
echo ""
echo "  ⚠️  복원 전 VPS DB가 비어있는지 확인하세요."
echo "     기존 데이터가 있으면 --clean 옵션으로 인해 덮어써집니다."
echo ""
