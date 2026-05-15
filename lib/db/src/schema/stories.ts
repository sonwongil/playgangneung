import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const storiesTable = pgTable(
  "stories",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    sourceUrl: text("source_url").notNull().default(""),
    author: text("author").notNull().default(""),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("stories_status_idx").on(t.status)],
);

export type StoryRow = typeof storiesTable.$inferSelect;
