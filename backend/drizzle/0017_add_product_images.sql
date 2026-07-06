create table if not exists "product_images" (
  "id" uuid primary key default gen_random_uuid(),
  "product_id" uuid not null references "products"("id") on delete cascade,
  "image_url" text not null,
  "sort_order" integer not null default 0,
  "created_at" timestamp not null default now()
);
