import { pgTable, text, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";

export const adPaymentsTable = pgTable("ad_payments", {
  id:            text("id").primaryKey(),
  orderId:       text("order_id").notNull().unique(),
  paymentKey:    text("payment_key"),

  productId:               text("product_id"),
  productNameSnapshot:     text("product_name_snapshot"),
  productPriceSnapshot:    integer("product_price_snapshot"),
  marginRateSnapshot:      real("margin_rate_snapshot"),
  adDurationDaysSnapshot:  integer("ad_duration_days_snapshot"),
  productTypeSnapshot:     text("product_type_snapshot"),

  adId:          text("ad_id"),
  plan:          text("plan").notNull().default(""),
  amount:        integer("amount").notNull(),
  status:        text("status").notNull().default("pending"),
  method:        text("method"),
  receiptUrl:    text("receipt_url"),
  customerName:  text("customer_name").notNull().default(""),
  customerEmail: text("customer_email").notNull().default(""),
  depositName:   text("deposit_name"),
  rawResponse:   jsonb("raw_response"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  paidAt:        timestamp("paid_at"),
});

export type AdPaymentRow = typeof adPaymentsTable.$inferSelect;
