import { pgTable, text, jsonb, timestamp, integer, real, uniqueIndex } from "drizzle-orm/pg-core";

export const adPoolsTable = pgTable("ad_pools", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  objective: text("objective").notNull().default("awareness"),
  adIds: jsonb("ad_ids").$type<string[]>().notNull().default([]),
  adDates: jsonb("ad_dates").$type<Record<string, { startDate: string; endDate: string }>>().notNull().default({}),
  totalBudget: integer("total_budget").notNull().default(0),
  startDate: text("start_date").notNull().default(""),
  endDate: text("end_date").notNull().default(""),
  aiMode: text("ai_mode").notNull().default("equal"),
  rotationMode: text("rotation_mode").notNull().default("equal"), // "equal"=공정 균등 노출 | "performance"=Meta 자동 최적화
  status: text("status").notNull().default("draft"),
  metaCampaignId: text("meta_campaign_id"),
  metaAdSetId: text("meta_ad_set_id"),
  metaSyncedAt: timestamp("meta_synced_at"),
  metaSyncStatus: text("meta_sync_status"),
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
  aiReason: text("ai_reason"),
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
  ctr: real("ctr"),
  cpc: integer("cpc"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ad_perf_uniq").on(t.adId, t.poolId, t.date, t.source),
]);

export type AdPerformanceRow = typeof adPerformancesTable.$inferSelect;

export const adAlertsTable = pgTable("ad_alerts", {
  id: text("id").primaryKey(),
  type: text("type").notNull().default("info"),
  level: text("level").notNull().default("info"),
  message: text("message").notNull().default(""),
  adId: text("ad_id"),
  poolId: text("pool_id"),
  resolved: integer("resolved").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AdAlertRow = typeof adAlertsTable.$inferSelect;

export const metaCampaignBudgetsTable = pgTable("meta_campaign_budgets", {
  campaignId: text("campaign_id").primaryKey(),
  campaignName: text("campaign_name").notNull().default(""),
  dailyLimit: integer("daily_limit").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type MetaCampaignBudgetRow = typeof metaCampaignBudgetsTable.$inferSelect;

export const metaAdInsightsTable = pgTable("meta_ad_insights", {
  id: text("id").primaryKey(),
  adId: text("ad_id").notNull(),
  adName: text("ad_name").notNull().default(""),
  adSetId: text("ad_set_id"),
  adSetName: text("ad_set_name"),
  campaignId: text("campaign_id"),
  campaignName: text("campaign_name"),
  dateStart: text("date_start").notNull(),
  dateStop: text("date_stop").notNull(),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  spend: real("spend").notNull().default(0),
  reach: integer("reach").notNull().default(0),
  frequency: real("frequency"),
  ctr: real("ctr"),
  cpc: real("cpc"),
  cpp: real("cpp"),
  status: text("status"),
  healthStatus: text("health_status").notNull().default("ok"),
  healthIssues: jsonb("health_issues").$type<string[]>().notNull().default([]),
  collectedAt: timestamp("collected_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("meta_ad_insights_uniq").on(t.adId, t.dateStart),
]);

export type MetaAdInsightRow = typeof metaAdInsightsTable.$inferSelect;
