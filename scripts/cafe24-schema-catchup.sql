-- =============================================================
-- PLAY강릉 Cafe24 DB 스키마 캐치업 스크립트
-- =============================================================
-- 목적: Replit DB 기준 최신 스키마를 Cafe24 DB에 안전하게 적용
-- 특징: 모든 구문이 멱등성(idempotent) — 이미 존재하면 오류 없이 건너뜀
-- 실행: psql "$DATABASE_URL" -f cafe24-schema-catchup.sql
-- 작성: 2026-06-04  Replit DB 기준
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- [1] 누락된 테이블 생성 (IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────

-- daily_top5 (TOP5 기능 — Cafe24에서 확인된 누락 테이블)
CREATE TABLE IF NOT EXISTS "daily_top5" (
  "date"  date PRIMARY KEY,
  "items" jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- site_config (사이트 설정 KV 저장소)
CREATE TABLE IF NOT EXISTS "site_config" (
  "key"        text PRIMARY KEY,
  "value"      text NOT NULL,
  "updated_at" timestamptz DEFAULT now()
);

-- meta_ad_insights (Meta 광고 성과 수집 테이블)
CREATE TABLE IF NOT EXISTS "meta_ad_insights" (
  "id"            text PRIMARY KEY,
  "ad_id"         text NOT NULL,
  "ad_name"       text NOT NULL DEFAULT '',
  "ad_set_id"     text,
  "ad_set_name"   text,
  "campaign_id"   text,
  "campaign_name" text,
  "date_start"    text NOT NULL,
  "date_stop"     text NOT NULL,
  "impressions"   integer NOT NULL DEFAULT 0,
  "clicks"        integer NOT NULL DEFAULT 0,
  "spend"         real    NOT NULL DEFAULT 0,
  "reach"         integer NOT NULL DEFAULT 0,
  "frequency"     real,
  "ctr"           real,
  "cpc"           real,
  "cpp"           real,
  "status"        text,
  "health_status" text    NOT NULL DEFAULT 'ok',
  "health_issues" jsonb   NOT NULL DEFAULT '[]'::jsonb,
  "collected_at"  timestamp NOT NULL DEFAULT now()
);

-- meta_campaign_budgets (Meta 캠페인 일일 예산 추적)
CREATE TABLE IF NOT EXISTS "meta_campaign_budgets" (
  "campaign_id"   text PRIMARY KEY,
  "campaign_name" text    NOT NULL DEFAULT '',
  "daily_limit"   integer NOT NULL DEFAULT 0,
  "updated_at"    timestamp NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- [2] 누락된 인덱스 생성 (IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "meta_ad_insights_uniq"
  ON "meta_ad_insights" ("ad_id", "date_start");

-- ─────────────────────────────────────────────────────────────
-- [3] events 테이블 — 누락 컬럼 추가 (ADD COLUMN IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────

-- 추가된 시점: 마이그레이션 0000 이후 schema 직접 수정
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "extra_images"        jsonb,
  ADD COLUMN IF NOT EXISTS "hashtags"            jsonb,
  ADD COLUMN IF NOT EXISTS "user_id"             text,
  ADD COLUMN IF NOT EXISTS "author_display_name" text,
  ADD COLUMN IF NOT EXISTS "image_expires_at"    timestamp;

-- ─────────────────────────────────────────────────────────────
-- [4] ads 테이블 — 누락 컬럼 추가
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "ads"
  ADD COLUMN IF NOT EXISTS "extra_images"        jsonb,
  ADD COLUMN IF NOT EXISTS "is_premium_featured" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "user_id"             text,
  ADD COLUMN IF NOT EXISTS "image_expires_at"    timestamp;

-- ─────────────────────────────────────────────────────────────
-- [5] ad_pools 테이블 — 누락 컬럼 추가
-- ─────────────────────────────────────────────────────────────

-- rotation_mode: 광고 로테이션 방식 ('equal' | 'performance')
ALTER TABLE "ad_pools"
  ADD COLUMN IF NOT EXISTS "rotation_mode" text NOT NULL DEFAULT 'equal',
  ADD COLUMN IF NOT EXISTS "ad_dates"      jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- [6] ad_payments 테이블 — 누락 컬럼 추가
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "ad_payments"
  ADD COLUMN IF NOT EXISTS "deposit_name" text;

-- ─────────────────────────────────────────────────────────────
-- [7] 검증 쿼리 — 적용 결과 확인
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  missing_tables text[] := ARRAY[]::text[];
  missing_cols   text[] := ARRAY[]::text[];
  tbl text;
  col text;
BEGIN
  -- 테이블 존재 확인
  FOREACH tbl IN ARRAY ARRAY[
    'daily_top5','site_config','meta_ad_insights','meta_campaign_budgets'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=tbl
    ) THEN
      missing_tables := array_append(missing_tables, tbl);
    END IF;
  END LOOP;

  IF array_length(missing_tables, 1) > 0 THEN
    RAISE EXCEPTION '테이블 생성 실패: %', array_to_string(missing_tables, ', ');
  END IF;

  RAISE NOTICE '✅ 모든 테이블 존재 확인 완료';
  RAISE NOTICE '✅ 캐치업 스크립트 정상 적용';
END $$;

COMMIT;

-- =============================================================
-- 실행 후 수동 확인 쿼리
-- =============================================================
-- SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
-- SELECT column_name FROM information_schema.columns WHERE table_name='events' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name='ads' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name='ad_pools' ORDER BY ordinal_position;
