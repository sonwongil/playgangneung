-- Phase 3: Meta 광고 API 연동 컬럼 추가
ALTER TABLE "ad_pools" ADD COLUMN IF NOT EXISTS "meta_campaign_id" text;
ALTER TABLE "ad_pools" ADD COLUMN IF NOT EXISTS "meta_ad_set_id" text;
ALTER TABLE "ad_pools" ADD COLUMN IF NOT EXISTS "meta_synced_at" timestamp;
ALTER TABLE "ad_pools" ADD COLUMN IF NOT EXISTS "meta_sync_status" text;
ALTER TABLE "ads" ADD COLUMN IF NOT EXISTS "meta_ad_id" text;
