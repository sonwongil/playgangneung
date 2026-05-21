import { pgTable, text, jsonb, timestamp, integer, real } from "drizzle-orm/pg-core";

export const adPoolsTable = pgTable("ad_pools", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  objective: text("objective").notNull().default("awareness"),
  adIds: jsonb("ad_ids").$type<string[]>().notNull().default([]),
  totalBudget: integer("total_budget").notNull().default(0),
  startDate: text("start_date").notNull().default(""),
  endDate: text("end_date").notNull().default(""),
  aiMode: text("ai_mode").notNull().default("equal"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AdPoolRow = typeof adPoolsTable.$inferSelect;

export const rotationRulesTable = pgTable("rotation_rules", {
  id: text("id").primaryKey(),
  poolId: text("pool_id").notNull(),
  adId: text("ad_id").notNull(),
  hourSlot: integer("hour_slot").notNull().default(0),
  weight: real("weight").notNull().default(1),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RotationRuleRow = typeof rotationRulesTable.$inferSelect;

export const adPerformancesTable = pgTable("ad_performances", {
  id: text("id").primaryKey(),
  adId: text("ad_id").notNull(),
  poolId: text("pool_id"),
  date: text("date").notNull().default(""),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  spend: integer("spend").notNull().default(0),
  reach: integer("reach").notNull().default(0),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AdPerformanceRow = typeof adPerformancesTable.$inferSelect;
