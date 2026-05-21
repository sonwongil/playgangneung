import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const adPaymentsTable = pgTable("ad_payments", {
  id:            text("id").primaryKey(),
  orderId:       text("order_id").notNull().unique(),
  paymentKey:    text("payment_key"),
  adId:          text("ad_id"),
  plan:          text("plan").notNull(),
  amount:        integer("amount").notNull(),
  status:        text("status").notNull().default("pending"),
  method:        text("method"),
  receiptUrl:    text("receipt_url"),
  customerName:  text("customer_name").notNull().default(""),
  customerEmail: text("customer_email").notNull().default(""),
  rawResponse:   jsonb("raw_response"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  paidAt:        timestamp("paid_at"),
});

export type AdPaymentRow = typeof adPaymentsTable.$inferSelect;
