# Cafe24 DB 스키마 동기화 계획서

> **목적**: Replit DB 기준 최신 스키마를 Cafe24 DB에 안전하게 적용  
> **전제**: 코드 수정 없음 — 분석 및 SQL 적용만  
> **날짜**: 2026-06-04

---

## 1. 스키마 차이 분석 — 전체 현황

### 1-1. Replit DB vs Cafe24 DB 테이블 수

| 항목 | Replit DB | Cafe24 DB |
|---|---|---|
| 전체 테이블 수 | **17개** | **15개** |
| 마이그레이션 추적 | `__drizzle_migrations` 0건 (push 사용) | 미확인 |

### 1-2. 테이블 비교

| 테이블 | Replit | Cafe24 | 차이 |
|---|---|---|---|
| events | ✅ | ✅ | 컬럼 5개 누락 (아래) |
| ads | ✅ | ✅ | 컬럼 4개 누락 (아래) |
| ad_pools | ✅ | ✅ | 컬럼 2개 누락 (아래) |
| ad_payments | ✅ | ✅ | 컬럼 1개 누락 |
| ad_performances | ✅ | ✅ | 동일 (0003에서 추가됨) |
| ad_alerts | ✅ | ✅ | 동일 |
| ad_products | ✅ | ✅ | 동일 |
| rotation_rules | ✅ | ✅ | 동일 |
| auth_config | ✅ | ✅ | 동일 |
| blog_sources | ✅ | ✅ | 동일 |
| crawl_sources | ✅ | ✅ | 동일 |
| stories | ✅ | ✅ | 동일 |
| videos | ✅ | ✅ | 동일 |
| **daily_top5** | ✅ | ❌ **누락** | 테이블 없음 (사용자 확인) |
| **site_config** | ✅ | ❓ | 마이그레이션에 없음 — 확인 필요 |
| **meta_ad_insights** | ✅ | ❓ | 마이그레이션에 없음 — 확인 필요 |
| **meta_campaign_budgets** | ✅ | ❓ | 마이그레이션에 없음 — 확인 필요 |

> Cafe24 15개 = 17개 - 2개 누락. `daily_top5` 1개는 확인됨. 나머지 1개는 아래 확인 명령어로 특정 필요.

### 1-3. 누락 컬럼 상세

#### events 테이블 (Cafe24에서 누락 예상)

| 컬럼명 | 타입 | 기본값 | 용도 |
|---|---|---|---|
| `extra_images` | jsonb | null | 추가 이미지 배열 |
| `hashtags` | jsonb | null | 해시태그 배열 |
| `user_id` | text | null | Clerk 회원 연동 |
| `author_display_name` | text | null | 작성자 표시명 |
| `image_expires_at` | timestamp | null | 이미지 만료 시각 |

#### ads 테이블 (Cafe24에서 누락 예상)

| 컬럼명 | 타입 | 기본값 | 용도 |
|---|---|---|---|
| `extra_images` | jsonb | null | 추가 이미지 배열 |
| `is_premium_featured` | boolean | false (NOT NULL) | 프리미엄 노출 플래그 |
| `user_id` | text | null | Clerk 회원 연동 |
| `image_expires_at` | timestamp | null | 이미지 만료 시각 |

#### ad_pools 테이블 (Cafe24에서 누락 예상)

| 컬럼명 | 타입 | 기본값 | 용도 |
|---|---|---|---|
| `rotation_mode` | text | 'equal' (NOT NULL) | 광고 로테이션 방식 |
| `ad_dates` | jsonb | '{}' (NOT NULL) | 광고별 기간 설정 |

#### ad_payments 테이블 (Cafe24에서 누락 예상)

| 컬럼명 | 타입 | 기본값 | 용도 |
|---|---|---|---|
| `deposit_name` | text | null | 무통장 입금자명 |

---

## 2. 핵심 발견 — 왜 마이그레이션 파일과 실제 DB가 다른가

### Replit DB는 `drizzle-kit push`로 생성됨

```
Replit DB의 __drizzle_migrations 테이블: 0건
→ drizzle-kit migrate 가 한 번도 실행된 적 없음
→ drizzle-kit push (스키마 직접 동기화) 또는 수동 ALTER TABLE로 생성
```

**결과**: `lib/db/drizzle/` 마이그레이션 파일(0000~0008)은 Replit DB에 적용되지 않은 상태로 남아있습니다. 마이그레이션 파일보다 실제 Replit DB 스키마가 더 최신입니다.

### 마이그레이션 파일에 없는 테이블/컬럼

| 항목 | 마이그레이션 파일에 없는 이유 |
|---|---|
| `daily_top5` | 2026-06-01 스키마에 추가됨, 마이그레이션 파일 미생성 |
| `site_config` | 2026-06-02 스키마에 추가됨, 마이그레이션 파일 미생성 |
| `meta_ad_insights` | 스키마에 정의되어 있으나 마이그레이션 파일 없음 |
| `meta_campaign_budgets` | 스키마에 정의되어 있으나 마이그레이션 파일 없음 |
| `events.*` 5개 컬럼 | 마이그레이션 0000 이후 스키마만 수정, SQL 미작성 |
| `ads.*` 4개 컬럼 | 마이그레이션 이후 스키마만 수정, SQL 미작성 |
| `ad_pools.*` 2개 컬럼 | 마이그레이션 이후 스키마만 수정, SQL 미작성 |
| `ad_payments.deposit_name` | 마이그레이션 0008 이후 추가, SQL 미작성 |

---

## 3. Cafe24 스키마 동기화 절차

### 준비된 파일

```
scripts/cafe24-schema-catchup.sql
```

이 파일은 멱등성(idempotent) SQL입니다:
- `CREATE TABLE IF NOT EXISTS` — 이미 있으면 건너뜀
- `ADD COLUMN IF NOT EXISTS` — 이미 있으면 건너뜀
- 트랜잭션(BEGIN/COMMIT)으로 감싸여 있어 중간 오류 시 전체 롤백

### Step 1. Cafe24 현재 상태 정확히 확인 (VPS 실행)

```bash
# 현재 테이블 목록과 수
psql "$DATABASE_URL" -c "
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"

# events 현재 컬럼 목록
psql "$DATABASE_URL" -c "
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='events'
ORDER BY ordinal_position;"

# ads 현재 컬럼 목록
psql "$DATABASE_URL" -c "
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='ads'
ORDER BY ordinal_position;"

# ad_pools 현재 컬럼 목록
psql "$DATABASE_URL" -c "
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='ad_pools'
ORDER BY ordinal_position;"
```

### Step 2. 백업 (필수 — 스크립트 실행 전)

```bash
cd /var/www/playgangneung
source .env

BACKUP_FILE="backups/pre-schema-catchup-$(date +%Y%m%d_%H%M).sql.gz"
mkdir -p backups

pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# 백업 완료 확인
ls -lh "$BACKUP_FILE"
echo "백업 완료: $BACKUP_FILE"
```

### Step 3. 스크립트 파일을 VPS로 복사

```bash
# Replit에서 scp로 전송 (Replit 터미널)
scp scripts/cafe24-schema-catchup.sql root@116.124.133.163:/tmp/

# 또는 내용을 직접 복사해서 VPS에 파일 생성
```

### Step 4. 스크립트 실행

```bash
# VPS에서 실행
source /var/www/playgangneung/.env

psql "$DATABASE_URL" -f /tmp/cafe24-schema-catchup.sql
```

#### 정상 실행 시 예상 출력

```
BEGIN
CREATE TABLE    ← daily_top5
CREATE TABLE    ← site_config
CREATE TABLE    ← meta_ad_insights
CREATE TABLE    ← meta_campaign_budgets
CREATE INDEX
ALTER TABLE     ← events 컬럼 추가
ALTER TABLE     ← ads 컬럼 추가
ALTER TABLE     ← ad_pools 컬럼 추가
ALTER TABLE     ← ad_payments 컬럼 추가
NOTICE:  ✅ 모든 테이블 존재 확인 완료
NOTICE:  ✅ 캐치업 스크립트 정상 적용
COMMIT
```

### Step 5. 적용 결과 검증

```bash
source /var/www/playgangneung/.env

# 전체 테이블 수 확인 (17개여야 함)
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS table_count
FROM pg_tables WHERE schemaname='public';"

# daily_top5 존재 확인
psql "$DATABASE_URL" -c "
SELECT to_regclass('public.daily_top5');"
# → daily_top5 (null이면 실패)

# events 컬럼 수 확인 (24개여야 함)
psql "$DATABASE_URL" -c "
SELECT COUNT(*) FROM information_schema.columns
WHERE table_schema='public' AND table_name='events';"

# ads 컬럼 수 확인 (30개여야 함)
psql "$DATABASE_URL" -c "
SELECT COUNT(*) FROM information_schema.columns
WHERE table_schema='public' AND table_name='ads';"

# /api/top5 서버 응답 확인
curl -sf http://localhost:8080/api/top5
# → {"data":[...]} (daily_top5 테이블 쿼리 성공)
```

---

## 4. 롤백 절차

### 시나리오 A: 스크립트 실행 중 오류 발생

스크립트가 트랜잭션 안에서 실행되므로, 오류 발생 시 `ROLLBACK`이 자동으로 실행됩니다. DB 상태는 스크립트 실행 전과 동일합니다. 원인을 분석 후 재실행하면 됩니다.

### 시나리오 B: 스크립트는 성공했으나 앱이 오동작

```bash
cd /var/www/playgangneung
source .env

# 백업 파일로 전체 복원
BACKUP_FILE="backups/pre-schema-catchup-YYYY-MM-DD_HHMM.sql.gz"
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"

pm2 restart playgangneung
```

### 시나리오 C: NOT NULL 컬럼 추가로 인한 오류

`is_premium_featured` 와 `rotation_mode`, `ad_dates` 는 `NOT NULL + DEFAULT` 로 추가됩니다. 기존 행이 있어도 기본값이 자동으로 채워지므로 문제없습니다.

---

## 5. 데이터 동기화 (스키마 동기화와 별개)

스키마 캐치업 후 데이터 동기화 여부를 결정합니다.

### 현재 데이터 비교

| 테이블 | Replit | Cafe24 |
|---|---|---|
| events | 0 (개발 DB) | 139 (운영 데이터) |
| ad_pools | 0 | 0 |
| ads | 0 | 미확인 |
| auth_config | 0 | 있어야 함 (로그인용) |
| site_config | 0 | 없음 (테이블도 없었음) |

**판단**: Replit DB(개발 환경)의 `events`는 0건이고, Cafe24 DB의 `events`는 139건입니다.  
데이터 동기화 방향은 **Cafe24 → Cafe24 유지**입니다. Replit DB 데이터를 덮어쓰면 안 됩니다.

유일하게 Replit → Cafe24로 동기화해야 할 데이터: **없음**  
(Replit DB는 개발용이며, 운영 데이터는 Cafe24가 최신)

---

## 6. 스키마 동기화 완료 후 다음 단계

```
[완료] 스키마 캐치업 SQL 적용
    ↓
[다음] Cafe24 PM2 fork/1 정상화 (migration-plan.md Phase 2)
    ↓
[다음] 기능 검증 — /api/top5, 관리자 로그인 등 (Phase 3)
    ↓
[다음] DNS 전환 (Phase 5)
```

---

## 7. 요약

| 항목 | 상태 |
|---|---|
| 확인된 누락 테이블 | `daily_top5` (1개 확정, 2개 추가 예상) |
| 확인된 누락 컬럼 | events 5개, ads 4개, ad_pools 2개, ad_payments 1개 |
| 캐치업 스크립트 | `scripts/cafe24-schema-catchup.sql` 준비 완료 |
| 스크립트 안전성 | 멱등성 (중복 실행 안전), 트랜잭션 (실패 시 자동 롤백) |
| 데이터 방향 | Cafe24 DB 데이터가 최신 — Replit 덮어쓰기 금지 |
