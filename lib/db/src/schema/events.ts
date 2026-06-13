import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/** 기존 레거시 블록 포맷 */
export interface LegacyContentBlock {
  type: "text" | "image" | "video";
  content: string;
}

/** BlockNote 저장 포맷(0.27+) 또는 레거시 포맷 모두 수용 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContentBlock = LegacyContentBlock | Record<string, any>;

export const eventsTable = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    date: text("date").notNull().default(""),
    startDate: text("start_date").notNull().default(""),
    endDate: text("end_date").notNull().default(""),
    scheduleStatus: text("schedule_status").notNull().default("upcoming"),
    location: text("location").notNull().default(""),
    category: text("category").notNull().default("지역소식"),
    thumbnail: text("thumbnail"),
    extraImages: jsonb("extra_images").$type<string[]>(),
    videoUrl: text("video_url"),
    link: text("link").notNull().default(""),
    source: text("source").notNull().default(""),
    contact: text("contact").notNull().default(""),
    sourceType: text("source_type").notNull().default("html"),
    status: text("status").notNull().default("draft"),
    socialDraft: jsonb("social_draft"),
    hashtags: jsonb("hashtags").$type<string[]>(),
    crawledAt: text("crawled_at").notNull().default(""),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    imageExpiresAt: timestamp("image_expires_at"),
    userId: text("user_id"),
    authorDisplayName: text("author_display_name"),
    contentBlocks: jsonb("content_blocks").$type<ContentBlock[]>(),
  },
  (t) => [index("events_status_idx").on(t.status)],
);

export type EventRow = typeof eventsTable.$inferSelect;
