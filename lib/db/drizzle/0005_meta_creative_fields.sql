ALTER TABLE "ads" ADD COLUMN IF NOT EXISTS "meta_creative_id" text;
ALTER TABLE "ads" ADD COLUMN IF NOT EXISTS "meta_image_hash" text;
ALTER TABLE "ads" ADD COLUMN IF NOT EXISTS "meta_status" text;
