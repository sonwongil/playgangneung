import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const siteConfigTable = pgTable("site_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});
