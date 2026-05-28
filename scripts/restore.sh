#!/usr/bin/env bash
# PostgreSQL 복구 검증 스크립트 — PLAY강릉
# 사용법: bash scripts/restore.sh [YYYY-MM-DD] [--dry-run] [--yes]
#
#   인수 없음      — 가장 최근 백업 자동 선택
#   YYYY-MM-DD    — 지정 날짜 백업 복원
#   --dry-run     — 실제 변경 없이 동작만 검증
#   --yes / -y    — 확인 프롬프트 생략 (자동화용)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$WORKSPACE_ROOT/backups"
SAFEGUARD_DIR="$BACKUP_DIR/.safeguard"
PUBLIC_DIR="$WORKSPACE_ROOT/artifacts/api-server/public"
LOG_FILE="$BACKUP_DIR/restore.log"

# ── 인수 파싱 ────────────────────────────────────────────────────────────────
DATE=""
DRY_RUN=0
AUTO_YES=0

for arg in "$@"; do
  case "$arg" in
    --dry-run)    DRY_RUN=1 ;;
    --yes | -y)   AUTO_YES=1 ;;
    --*)          echo "❌ 알 수 없는 옵션: $arg"; exit 1 ;;
    *)            DATE="$arg" ;;
  esac
done

mkdir -p "$BACKUP_DIR" "$SAFEGUARD_DIR"

# ── 로그 함수 ────────────────────────────────────────────────────────────────
log() {
  local msg="[$(TZ='Asia/Seoul' date '+%Y-%m-%d %H:%M:%S KST')] $*"
  echo "$msg" | tee -a "$LOG_FILE"
}

log_only() {
  echo "[$(TZ='Asia/Seoul' date '+%Y-%m-%d %H:%M:%S KST')] $*" >> "$LOG_FILE"
}

# ── 백업 목록 출력 ───────────────────────────────────────────────────────────
list_backups() {
  echo ""
  echo "사용 가능한 백업:"
  local found=0
  if ls "$BACKUP_DIR"/*.sql.gz &>/dev/null 2>&1; then
    ls -1t "$BACKUP_DIR"/*.sql.gz | while read -r f; do
      local d size up_info
      d=$(basename "$f" .sql.gz)
      size=$(du -sh "$f" | cut -f1)
      up_info=""
      [ -f "$BACKUP_DIR/${d}-uploads.tar.gz" ] && \
        up_info=" + 파일($(du -sh "$BACKUP_DIR/${d}-uploads.tar.gz" | cut -f1))"
      printf "  %s  DB: %s%s\n" "$d" "$size" "$up_info"
      found=1
    done
  fi
  [ "$found" -eq 0 ] && echo "  (백업 파일 없음)"
  echo ""
}

# ── 1. 가장 최근 백업 자동 탐색 ─────────────────────────────────────────────
if [ -z "$DATE" ]; then
  LATEST=$(ls -1t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1 || true)
  if [ -z "$LATEST" ]; then
    echo "❌ 사용 가능한 백업이 없습니다: $BACKUP_DIR"
    exit 1
  fi
  DATE=$(basename "$LATEST" .sql.gz)
  echo "ℹ️  최신 백업 자동 선택: $DATE"
fi

DB_FILE="$BACKUP_DIR/${DATE}.sql.gz"
UPLOADS_FILE="$BACKUP_DIR/${DATE}-uploads.tar.gz"

# ── 2. 사전 환경 검사 ────────────────────────────────────────────────────────
PREFLIGHT_OK=1

if [ ! -f "$DB_FILE" ]; then
  echo "❌ DB 백업 파일을 찾을 수 없습니다: $DB_FILE"
  list_backups
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL 환경변수가 설정되지 않았습니다"
  PREFLIGHT_OK=0
fi

for cmd in pg_dump psql zcat gzip tar; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "❌ 필수 명령어 없음: $cmd"
    PREFLIGHT_OK=0
  fi
done

if [ "$PREFLIGHT_OK" -eq 0 ]; then
  exit 1
fi

# 파일 무결성 체크 (gzip 헤더 확인)
if ! gzip -t "$DB_FILE" 2>/dev/null; then
  echo "❌ 백업 파일이 손상되었습니다: $DB_FILE"
  exit 1
fi

DB_SIZE=$(du -sh "$DB_FILE" | cut -f1)
HAS_UPLOADS=0
UPLOADS_SIZE=""
if [ -f "$UPLOADS_FILE" ]; then
  HAS_UPLOADS=1
  UPLOADS_SIZE=$(du -sh "$UPLOADS_FILE" | cut -f1)
  if ! gzip -t "$UPLOADS_FILE" 2>/dev/null; then
    echo "⚠️  파일 백업이 손상되었습니다: $UPLOADS_FILE (건너뜀)"
    HAS_UPLOADS=0
  fi
fi

SAFEGUARD_NAME="pre-restore-$(TZ='Asia/Seoul' date '+%Y%m%d-%H%M%S').sql.gz"
SAFEGUARD_FILE="$SAFEGUARD_DIR/$SAFEGUARD_NAME"

# ── 3. 복구 계획 출력 ────────────────────────────────────────────────────────
echo ""
echo "┌──────────────────────────────────────────────────────────────────┐"
if [ "$DRY_RUN" -eq 1 ]; then
echo "│  📋 복구 계획  [DRY-RUN — 실제 변경 없음]                         │"
else
echo "│  📋 복구 계획                                                      │"
fi
echo "├──────────────────────────────────────────────────────────────────┤"
printf "│  복원 날짜  : %-51s│\n" "$DATE"
printf "│  DB 파일   : %-51s│\n" "$(basename "$DB_FILE") ($DB_SIZE)"
if [ "$HAS_UPLOADS" -eq 1 ]; then
printf "│  파일 백업  : %-51s│\n" "$(basename "$UPLOADS_FILE") ($UPLOADS_SIZE)"
else
printf "│  파일 백업  : %-51s│\n" "(없음 — DB만 복원)"
fi
printf "│  임시 백업  : %-51s│\n" ".safeguard/$SAFEGUARD_NAME"
echo "├──────────────────────────────────────────────────────────────────┤"
echo "│  실행 단계:                                                        │"
echo "│   ① 현재 DB 임시 백업 (.safeguard/)                               │"
echo "│   ② DB 복원 (DROP/CREATE → INSERT)                                │"
echo "│   ③ 복원 후 테이블 레코드 수 검증                                  │"
if [ "$HAS_UPLOADS" -eq 1 ]; then
echo "│   ④ uploads/cards 파일 복원                                        │"
fi
echo "├──────────────────────────────────────────────────────────────────┤"
echo "│  ⚠️   현재 데이터베이스가 선택한 백업으로 교체됩니다.               │"
echo "│      실패 시 ①번 임시 백업으로 롤백 가능합니다.                    │"
echo "└──────────────────────────────────────────────────────────────────┘"
echo ""

# ── dry-run 종료 ──────────────────────────────────────────────────────────────
if [ "$DRY_RUN" -eq 1 ]; then
  echo "✅ 사전 검사 통과 (gzip 무결성 확인 완료)"
  echo "   DB 파일:   $DB_FILE ($DB_SIZE)"
  [ "$HAS_UPLOADS" -eq 1 ] && echo "   파일 백업: $UPLOADS_FILE ($UPLOADS_SIZE)"
  echo ""
  log_only "=== dry-run 실행 — 복원 날짜: $DATE ==="
  log_only "   사전 검사 통과, 실제 변경 없음"
  exit 0
fi

# ── 4. 사용자 확인 ───────────────────────────────────────────────────────────
if [ "$AUTO_YES" -eq 0 ]; then
  read -r -p "계속하시겠습니까? (yes 입력 시 진행): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "취소됨"
    exit 0
  fi
fi

EXIT_CODE=0
log "======================================================="
log "복구 시작: $DATE"
log "======================================================="

# ── ① 현재 DB 임시 백업 (세이프가드) ────────────────────────────────────────
log "① 현재 DB 임시 백업 생성 중..."
SAFEGUARD_TMP="${SAFEGUARD_FILE}.tmp"

if pg_dump "$DATABASE_URL" 2>>"$LOG_FILE" | gzip -9 > "$SAFEGUARD_TMP"; then
  mv "$SAFEGUARD_TMP" "$SAFEGUARD_FILE"
  SIZE=$(du -sh "$SAFEGUARD_FILE" | cut -f1)
  log "   ✅ 임시 백업 완료: $SAFEGUARD_NAME ($SIZE)"
  log "   롤백 명령: zcat $SAFEGUARD_FILE | psql \"\$DATABASE_URL\""
else
  rm -f "$SAFEGUARD_TMP"
  log "   ❌ 임시 백업 실패 — 안전을 위해 복구 중단"
  exit 1
fi

# 세이프가드 7개 초과분 정리
SAFEGUARD_LIST=()
while IFS= read -r f; do SAFEGUARD_LIST+=("$f"); done < <(ls -1t "$SAFEGUARD_DIR"/*.sql.gz 2>/dev/null || true)
if [ "${#SAFEGUARD_LIST[@]}" -gt 7 ]; then
  for old in "${SAFEGUARD_LIST[@]:7}"; do
    rm -f "$old"
    log_only "   세이프가드 정리: $(basename "$old")"
  done
fi

# ── ② DB 복원 ────────────────────────────────────────────────────────────────
log "② DB 복원 중: $(basename "$DB_FILE") ($DB_SIZE)..."
PSQL_LOG=$(mktemp)

if zcat "$DB_FILE" | psql "$DATABASE_URL" > "$PSQL_LOG" 2>&1; then
  PSQL_LINES=$(wc -l < "$PSQL_LOG" | tr -d ' ')
  log "   ✅ DB 복원 완료 (psql 출력 ${PSQL_LINES}줄)"
  cat "$PSQL_LOG" >> "$LOG_FILE"
else
  PSQL_LINES=$(wc -l < "$PSQL_LOG" | tr -d ' ')
  log "   ❌ DB 복원 실패 (psql 출력 ${PSQL_LINES}줄)"
  cat "$PSQL_LOG" >> "$LOG_FILE"
  log "   롤백: zcat $SAFEGUARD_FILE | psql \"\$DATABASE_URL\""
  rm -f "$PSQL_LOG"
  EXIT_CODE=1
fi
rm -f "$PSQL_LOG"

# ── ③ 복원 후 테이블 검증 ────────────────────────────────────────────────────
if [ "$EXIT_CODE" -eq 0 ]; then
  log "③ 복원 검증 중 (테이블 레코드 수)..."

  VERIFY_FAIL=0
  for table in events ad_pools ads ad_performances; do
    COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' \n' || echo "ERR")
    if [ "$COUNT" = "ERR" ]; then
      log "   ⚠️  $table — 조회 실패 (테이블 없거나 권한 오류)"
      VERIFY_FAIL=1
    else
      log "   ✅ $table: ${COUNT}건"
    fi
  done

  if [ "$VERIFY_FAIL" -eq 1 ]; then
    log "   ⚠️  일부 테이블 검증 실패 — DB는 복원됐으나 구조 확인 필요"
  else
    log "   ✅ 전체 테이블 검증 통과"
  fi
fi

# ── ④ uploads/cards 파일 복원 ────────────────────────────────────────────────
if [ "$EXIT_CODE" -eq 0 ] && [ "$HAS_UPLOADS" -eq 1 ]; then
  log "④ 파일 복원 중: $(basename "$UPLOADS_FILE") ($UPLOADS_SIZE)..."

  TAR_LOG=$(mktemp)
  if tar -xzf "$UPLOADS_FILE" -C "$PUBLIC_DIR" 2>"$TAR_LOG"; then
    FILE_COUNT=$(tar -tzf "$UPLOADS_FILE" 2>/dev/null | grep -v '/$' | wc -l | tr -d ' ')
    log "   ✅ 파일 복원 완료 (${FILE_COUNT}개 파일)"
  else
    log "   ⚠️  파일 복원 실패 (DB는 정상 복원됨)"
    cat "$TAR_LOG" >> "$LOG_FILE"
  fi
  rm -f "$TAR_LOG"

elif [ "$EXIT_CODE" -eq 0 ]; then
  log "④ 파일 백업 없음 — 건너뜀"
fi

# ── 최종 결과 ────────────────────────────────────────────────────────────────
echo ""
log "======================================================="
if [ "$EXIT_CODE" -eq 0 ]; then
  log "✅ 복구 완료: $DATE"
  log "   서버를 재시작하여 변경사항을 적용하세요."
  echo "✅ 복구 완료: $DATE"
  echo "   서버를 재시작하여 변경사항을 적용하세요."
else
  log "❌ 복구 실패: $DATE"
  log "   롤백 명령: zcat $SAFEGUARD_FILE | psql \"\$DATABASE_URL\""
  echo "❌ 복구 실패"
  echo "   롤백: zcat $SAFEGUARD_FILE | psql \"\$DATABASE_URL\""
fi
log "======================================================="

exit "$EXIT_CODE"
