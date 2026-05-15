import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const blogSourcesTable = pgTable("blog_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  blogId: text("blog_id").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BlogSourceRow = typeof blogSourcesTable.$inferSelect;
