import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const sourcesTable = pgTable("crawl_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SourceRow = typeof sourcesTable.$inferSelect;
