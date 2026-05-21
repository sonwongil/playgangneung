CREATE TABLE IF NOT EXISTS "ad_payments" (
  "id"             text PRIMARY KEY,
  "order_id"       text NOT NULL UNIQUE,
  "payment_key"    text,
  "ad_id"          text,
  "plan"           text NOT NULL,
  "amount"         integer NOT NULL,
  "status"         text NOT NULL DEFAULT 'pending',
  "method"         text,
  "receipt_url"    text,
  "customer_name"  text NOT NULL DEFAULT '',
  "customer_email" text NOT NULL DEFAULT '',
  "raw_response"   jsonb,
  "created_at"     timestamp NOT NULL DEFAULT now(),
  "paid_at"        timestamp
);
