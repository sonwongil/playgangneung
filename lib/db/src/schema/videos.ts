import { pgTable, text, timestamp, index, boolean, integer } from "drizzle-orm/pg-core";

export const videosTable = pgTable(
  "videos",
  {
    id: text("id").primaryKey(),
    youtubeId: text("youtube_id").notNull().default(""),
    title: text("title").notNull().default(""),
    channelName: text("channel_name").notNull().default(""),
    thumbnailUrl: text("thumbnail_url"),
    description: text("description").notNull().default(""),
    embeddable: boolean("embeddable"),
    viewCount: integer("view_count"),
    status: text("status").notNull().default("draft"),
    socialCaption: text("social_caption"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("videos_status_idx").on(t.status)],
);

export type VideoRow = typeof videosTable.$inferSelect;
