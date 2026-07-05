alter table "product_reviews" add column if not exists "customer_id" text references "user"("id") on delete set null;

create unique index if not exists "product_reviews_customer_unique"
  on "product_reviews" ("product_id", "customer_id")
  where "customer_id" is not null;
