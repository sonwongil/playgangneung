ALTER TABLE "ads" ADD COLUMN "ai_score" integer;--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "ai_note" text;--> statement-breakpoint
CREATE TABLE "ad_pools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"objective" text DEFAULT 'awareness' NOT NULL,
	"ad_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_budget" integer DEFAULT 0 NOT NULL,
	"start_date" text DEFAULT '' NOT NULL,
	"end_date" text DEFAULT '' NOT NULL,
	"ai_mode" text DEFAULT 'equal' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rotation_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"pool_id" text NOT NULL,
	"ad_id" text NOT NULL,
	"hour_slot" integer DEFAULT 0 NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_performances" (
	"id" text PRIMARY KEY NOT NULL,
	"ad_id" text NOT NULL,
	"pool_id" text,
	"date" text DEFAULT '' NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"spend" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
