CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"date" text DEFAULT '' NOT NULL,
	"start_date" text DEFAULT '' NOT NULL,
	"end_date" text DEFAULT '' NOT NULL,
	"schedule_status" text DEFAULT 'upcoming' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '지역소식' NOT NULL,
	"thumbnail" text,
	"video_url" text,
	"link" text DEFAULT '' NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"source_type" text DEFAULT 'html' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"social_draft" jsonb,
	"crawled_at" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_config" (
	"id" text PRIMARY KEY DEFAULT 'main' NOT NULL,
	"password_hash" text NOT NULL,
	"salt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_url" text DEFAULT '' NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" text PRIMARY KEY NOT NULL,
	"youtube_id" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"channel_name" text DEFAULT '' NOT NULL,
	"thumbnail_url" text,
	"description" text DEFAULT '' NOT NULL,
	"embeddable" boolean,
	"view_count" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"blog_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_sources_blog_id_unique" UNIQUE("blog_id")
);
--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stories_status_idx" ON "stories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "videos_status_idx" ON "videos" USING btree ("status");