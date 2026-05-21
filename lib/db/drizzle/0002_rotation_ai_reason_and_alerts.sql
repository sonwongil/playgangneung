ALTER TABLE "rotation_rules" ADD COLUMN "ai_reason" text;--> statement-breakpoint
CREATE TABLE "ad_alerts" (
"id" text PRIMARY KEY NOT NULL,
"type" text DEFAULT 'info' NOT NULL,
"level" text DEFAULT 'info' NOT NULL,
"message" text DEFAULT '' NOT NULL,
"ad_id" text,
"pool_id" text,
"resolved" integer DEFAULT 0 NOT NULL,
"created_at" timestamp DEFAULT now() NOT NULL
);
