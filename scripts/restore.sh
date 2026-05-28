#!/usr/bin/env bash
# PostgreSQL 백업 복원 스크립트 — PLAY강릉
# 사용법: bash scripts/restore.sh [YYYY-MM-DD]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$WORKSPACE_ROOT/backups"
PUBLIC_DIR="$WORKSPACE_ROOT/artifacts/api-server/public"

# ── 사용법 출력 ──────────────────────────────────────────────────────────────
usage() {
  echo "사용법: bash scripts/restore.sh [YYYY-MM-DD]"
  echo ""
  echo "사용 가능한 백업 목록:"
  if ls "$BACKUP_DIR"/*.sql.gz &>/dev/null 2>&1; then
    ls -1t "$BACKUP_DIR"/*.sql.gz | while read -r f; do
      DATE=$(basename "$f" .sql.gz)
      SIZE=$(du -sh "$f" | cut -f1)
      UPLOADS="$BACKUP_DIR/${DATE}-uploads.tar.gz"
      UPLOADS_INFO=""
      [ -f "$UPLOADS" ] && UPLOADS_INFO=" + uploads($(du -sh "$UPLOADS" | cut -f1))"
      echo "  $DATE  (DB: $SIZE$UPLOADS_INFO)"
    done
  else
    echo "  (백업 파일 없음)"
  fi
  exit 1
}

DATE="${1:-}"
[ -z "$DATE" ] && usage

DB_FILE="$BACKUP_DIR/${DATE}.sql.gz"
UPLOADS_FILE="$BACKUP_DIR/${DATE}-uploads.tar.gz"

# ── 파일/환경 확인 ───────────────────────────────────────────────────────────
if [ ! -f "$DB_FILE" ]; then
  echo "❌ DB 백업 파일을 찾을 수 없습니다: $DB_FILE"
  usage
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL 환경변수가 설정되지 않았습니다"
  exit 1
fi

if ! command -v psql &>/dev/null; then
  echo "❌ psql 명령어를 찾을 수 없습니다 (PostgreSQL 클라이언트 설치 필요)"
  exit 1
fi

# ── 경고 및 확인 ─────────────────────────────────────────────────────────────
echo ""
echo "┌─────────────────────────────────────────────────────┐"
echo "│  ⚠️   데이터베이스 복원 경고                           │"
echo "│                                                     │"
echo "│  복원 날짜: $DATE                              │"
echo "│  DB 파일:  $(basename "$DB_FILE")                    │"
echo "│                                                     │"
echo "│  현재 데이터베이스의 모든 데이터가 덮어씌워집니다.     │"
echo "│  이 작업은 되돌릴 수 없습니다.                        │"
echo "└─────────────────────────────────────────────────────┘"
echo ""
read -r -p "계속하시겠습니까? (yes 입력 시 진행): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "취소됨"
  exit 0
fi

# ── DB 복원 ─────────────────────────────────────────────────────────────────
echo ""
echo "🔄 DB 복원 중: $DATE..."
if zcat "$DB_FILE" | psql "$DATABASE_URL" 2>&1; then
  echo "✅ DB 복원 완료"
else
  echo "❌ DB 복원 실패"
  exit 1
fi

# ── 파일(uploads/cards) 복원 ─────────────────────────────────────────────────
if [ -f "$UPLOADS_FILE" ]; then
  echo ""
  UPLOADS_SIZE=$(du -sh "$UPLOADS_FILE" | cut -f1)
  echo "📦 파일 백업 발견: $(basename "$UPLOADS_FILE") ($UPLOADS_SIZE)"
  read -r -p "uploads/cards 폴더도 복원하시겠습니까? (yes/no): " CONFIRM2
  if [ "$CONFIRM2" = "yes" ]; then
    echo "🔄 파일 복원 중..."
    if tar -xzf "$UPLOADS_FILE" -C "$PUBLIC_DIR" 2>&1; then
      echo "✅ 파일 복원 완료"
    else
      echo "⚠️  파일 복원 실패 (DB는 이미 복원됨)"
    fi
  else
    echo "ℹ️  파일 복원 건너뜀"
  fi
else
  echo "ℹ️  파일 백업 없음 ($DATE-uploads.tar.gz) — DB만 복원됨"
fi

echo ""
echo "✅ 복원 완료: $DATE"
echo "   서버를 재시작하여 변경사항을 적용하세요."
