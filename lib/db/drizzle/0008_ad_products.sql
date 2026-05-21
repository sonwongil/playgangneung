CREATE TABLE "ad_products" (
  "id"               text PRIMARY KEY,
  "name"             text NOT NULL,
  "description"      text NOT NULL DEFAULT '',
  "amount"           integer NOT NULL,
  "ad_duration_days" integer,
  "product_type"     text NOT NULL DEFAULT 'etc',
  "is_active"        boolean NOT NULL DEFAULT true,
  "sort_order"       integer NOT NULL DEFAULT 0,
  "margin_rate"      real NOT NULL DEFAULT 0.3,
  "created_at"       timestamp NOT NULL DEFAULT now(),
  "updated_at"       timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ad_payments"
  ADD COLUMN "product_id"                text,
  ADD COLUMN "product_name_snapshot"     text,
  ADD COLUMN "product_price_snapshot"    integer,
  ADD COLUMN "margin_rate_snapshot"      real,
  ADD COLUMN "ad_duration_days_snapshot" integer,
  ADD COLUMN "product_type_snapshot"     text;
