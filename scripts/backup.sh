#!/usr/bin/env bash
# PostgreSQL 자동 백업 스크립트 — PLAY강릉
# 사용법: bash scripts/backup.sh [--dry-run]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$WORKSPACE_ROOT/backups"
PUBLIC_DIR="$WORKSPACE_ROOT/artifacts/api-server/public"
LOG_FILE="$BACKUP_DIR/backup.log"
KEEP_DAYS=7
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

mkdir -p "$BACKUP_DIR"

log() {
  local msg="[$(TZ='Asia/Seoul' date '+%Y-%m-%d %H:%M:%S KST')] $*"
  echo "$msg" | tee -a "$LOG_FILE"
}

DATE=$(TZ="Asia/Seoul" date +%Y-%m-%d)
EXIT_CODE=0

log "==============================="
log "백업 시작: $DATE${DRY_RUN:+ (dry-run)}"
log "==============================="

# ── 1. pg_dump 사전 확인 ─────────────────────────────────────────────────────
if ! command -v pg_dump &>/dev/null; then
  log "❌ pg_dump 명령어를 찾을 수 없습니다 (PostgreSQL 클라이언트 설치 필요)"
  EXIT_CODE=1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  log "❌ DATABASE_URL 환경변수가 설정되지 않았습니다"
  EXIT_CODE=1
fi

# ── 2. PostgreSQL 덤프 ──────────────────────────────────────────────────────
if [ "$EXIT_CODE" -eq 0 ]; then
  DB_FILE="$BACKUP_DIR/${DATE}.sql.gz"
  DB_TMP="${DB_FILE}.tmp"

  if [ "$DRY_RUN" -eq 1 ]; then
    log "ℹ️  [dry-run] DB 덤프 → $DB_FILE"
  else
    if pg_dump "$DATABASE_URL" 2>>"$LOG_FILE" | gzip -9 > "$DB_TMP"; then
      mv "$DB_TMP" "$DB_FILE"
      SIZE=$(du -sh "$DB_FILE" | cut -f1)
      log "✅ DB 백업 완료: ${DATE}.sql.gz ($SIZE)"
    else
      rm -f "$DB_TMP"
      log "❌ DB 백업 실패 (pg_dump 오류 — 위 로그 확인)"
      EXIT_CODE=1
    fi
  fi
fi

# ── 3. uploads + cards 폴더 압축 백업 ────────────────────────────────────────
UPLOADS_FILE="$BACKUP_DIR/${DATE}-uploads.tar.gz"
UPLOADS_TMP="${UPLOADS_FILE}.tmp"

# 존재하는 폴더만 포함
DIRS_TO_BACKUP=()
for sub in uploads cards; do
  [ -d "$PUBLIC_DIR/$sub" ] && DIRS_TO_BACKUP+=("$sub")
done

if [ ${#DIRS_TO_BACKUP[@]} -eq 0 ]; then
  log "ℹ️  uploads/cards 폴더가 없거나 비어 있음 — 파일 백업 건너뜀"
elif [ "$DRY_RUN" -eq 1 ]; then
  log "ℹ️  [dry-run] 파일 백업 → $UPLOADS_FILE (폴더: ${DIRS_TO_BACKUP[*]})"
else
  if tar -czf "$UPLOADS_TMP" -C "$PUBLIC_DIR" "${DIRS_TO_BACKUP[@]}" 2>>"$LOG_FILE"; then
    mv "$UPLOADS_TMP" "$UPLOADS_FILE"
    SIZE=$(du -sh "$UPLOADS_FILE" | cut -f1)
    log "✅ 파일 백업 완료: ${DATE}-uploads.tar.gz ($SIZE) [${DIRS_TO_BACKUP[*]}]"
  else
    rm -f "$UPLOADS_TMP"
    log "⚠️  파일 백업 실패 (tar 오류 — DB 백업은 정상)"
  fi
fi

# ── 4. 7일 초과 파일 정리 ────────────────────────────────────────────────────
if [ "$DRY_RUN" -eq 1 ]; then
  EXPIRED=$(find "$BACKUP_DIR" \( -name "*.sql.gz" -o -name "*-uploads.tar.gz" \) -mtime "+${KEEP_DAYS}" 2>/dev/null | wc -l | tr -d ' ')
  log "ℹ️  [dry-run] 삭제 대상 파일 ${EXPIRED}개 (mtime > ${KEEP_DAYS}일)"
else
  DELETED=$(find "$BACKUP_DIR" \( -name "*.sql.gz" -o -name "*-uploads.tar.gz" \) -mtime "+${KEEP_DAYS}" -print -delete 2>/dev/null | wc -l | tr -d ' ')
  log "🗑️  ${KEEP_DAYS}일 초과 파일 ${DELETED}개 삭제"
fi

# ── 5. 보관 현황 ─────────────────────────────────────────────────────────────
DB_COUNT=$(find "$BACKUP_DIR" -name "*.sql.gz" | wc -l | tr -d ' ')
log "📦 보관 중인 DB 백업: ${DB_COUNT}개"

log "==============================="
if [ "$EXIT_CODE" -eq 0 ]; then
  log "✅ 백업 완료 (종료 코드: 0)"
else
  log "❌ 백업 중 오류 발생 (종료 코드: $EXIT_CODE)"
fi
log "==============================="

exit "$EXIT_CODE"
