ALTER TABLE "orders" ADD COLUMN "payment_invoice_id" text DEFAULT '' NOT NULL;
ALTER TABLE "orders" ADD COLUMN "payment_invoice_status" text DEFAULT '' NOT NULL;
ALTER TABLE "orders" ADD COLUMN "payment_invoice_url" text DEFAULT '' NOT NULL;
