ALTER TABLE "orders" ADD COLUMN "courier" text DEFAULT '' NOT NULL;
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp;
ALTER TABLE "orders" ADD COLUMN "shipped_at" timestamp;
ALTER TABLE "orders" ADD COLUMN "tracking_number" text DEFAULT '' NOT NULL;
