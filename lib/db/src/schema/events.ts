import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

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
    videoUrl: text("video_url"),
    link: text("link").notNull().default(""),
    source: text("source").notNull().default(""),
    contact: text("contact").notNull().default(""),
    sourceType: text("source_type").notNull().default("html"),
    status: text("status").notNull().default("draft"),
    socialDraft: jsonb("social_draft"),
    crawledAt: text("crawled_at").notNull().default(""),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("events_status_idx").on(t.status)],
);

export type EventRow = typeof eventsTable.$inferSelect;
