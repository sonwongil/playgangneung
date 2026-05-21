-- Phase 4: 광고주 리포트 토큰 컬럼 추가
ALTER TABLE "ads" ADD COLUMN IF NOT EXISTS "report_token" text;
