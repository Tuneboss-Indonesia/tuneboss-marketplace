CREATE TABLE "payment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid,
  "provider" text DEFAULT 'xendit' NOT NULL,
  "event_type" text NOT NULL,
  "status" text DEFAULT '' NOT NULL,
  "external_id" text DEFAULT '' NOT NULL,
  "provider_reference" text DEFAULT '' NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
