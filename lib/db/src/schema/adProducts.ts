import { pgTable, text, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";

export const adProductsTable = pgTable("ad_products", {
  id:               text("id").primaryKey(),
  name:             text("name").notNull(),
  description:      text("description").notNull().default(""),
  amount:           integer("amount").notNull(),
  adDurationDays:   integer("ad_duration_days"),
  productType:      text("product_type").notNull().default("etc"),
  isActive:         boolean("is_active").notNull().default(true),
  sortOrder:        integer("sort_order").notNull().default(0),
  marginRate:       real("margin_rate").notNull().default(0.3),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
});

export type AdProductRow = typeof adProductsTable.$inferSelect;
export type NewAdProduct = typeof adProductsTable.$inferInsert;
