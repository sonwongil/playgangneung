import { pgTable, date, jsonb } from "drizzle-orm/pg-core";

export interface Top5SlotItem {
  eventId: string;
  rank: number;
}

export const dailyTop5Table = pgTable("daily_top5", {
  date: date("date").primaryKey(),
  items: jsonb("items").$type<Top5SlotItem[]>().notNull().default([]),
});
