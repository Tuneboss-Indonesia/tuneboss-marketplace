DELETE FROM "payment_events" a
USING "payment_events" b
WHERE a."provider_reference" = b."provider_reference"
  AND a."provider_reference" <> ''
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX "payment_events_provider_reference_unique" ON "payment_events" ("provider_reference") WHERE "provider_reference" <> '';
