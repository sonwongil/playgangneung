import { pgTable, text, jsonb, timestamp, boolean, integer, real } from "drizzle-orm/pg-core";

export const adsTable = pgTable("ads", {
  id: text("id").primaryKey(),
  businessName: text("business_name").notNull().default(""),
  contactName: text("contact_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  category: text("category").notNull().default("기타"),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  date: text("date").notNull().default(""),
  location: text("location").notNull().default(""),
  url: text("url").notNull().default(""),
  imageUrl: text("image_url"),
  extraImages: jsonb("extra_images").$type<string[]>(),
  socialDraft: jsonb("social_draft"),
  plan: text("plan").notNull().default("basic"),
  status: text("status").notNull().default("pending"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isFreeAd: boolean("is_free_ad").notNull().default(true),
  aiScore: integer("ai_score"),
  aiNote: text("ai_note"),
  metaAdId: text("meta_ad_id"),
});

export type AdRow = typeof adsTable.$inferSelect;
