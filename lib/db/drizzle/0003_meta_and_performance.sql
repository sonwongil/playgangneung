-- Phase 3: Meta 광고 API 연동 컬럼 추가
ALTER TABLE "ad_pools" ADD COLUMN IF NOT EXISTS "meta_campaign_id" text;
ALTER TABLE "ad_pools" ADD COLUMN IF NOT EXISTS "meta_ad_set_id" text;
ALTER TABLE "ad_pools" ADD COLUMN IF NOT EXISTS "meta_synced_at" timestamp;
ALTER TABLE "ad_pools" ADD COLUMN IF NOT EXISTS "meta_sync_status" text;
ALTER TABLE "ads" ADD COLUMN IF NOT EXISTS "meta_ad_id" text;
-- Phase 3: 성과 테이블 CTR/CPC 컬럼 + Unique Index
ALTER TABLE "ad_performances" ADD COLUMN IF NOT EXISTS "ctr" real;
ALTER TABLE "ad_performances" ADD COLUMN IF NOT EXISTS "cpc" integer;
CREATE UNIQUE INDEX IF NOT EXISTS "ad_perf_uniq" ON "ad_performances" ("ad_id", COALESCE("pool_id", ''), "date", "source");
