create table if not exists "product_reviews" (
  "id" uuid primary key default gen_random_uuid(),
  "product_id" uuid not null references "products"("id") on delete cascade,
  "author_name" text not null,
  "rating" integer not null default 5,
  "quote" text not null,
  "created_at" timestamp not null default now()
);

insert into "product_reviews" ("product_id", "author_name", "rating", "quote", "created_at")
select
  p."id",
  r."author_name",
  r."rating",
  r."quote",
  now() - (r."age_days" || ' days')::interval
from "products" p
cross join (values
  ('Fajar', 5, 'Pemasangan mudah, hasil tuning terasa langsung dari putaran bawah.', 8),
  ('Rizky', 5, 'Respons gas lebih halus dan motor tetap enak dipakai harian.', 15),
  ('Medy', 4, 'Data tuning jelas, cocok buat setup bengkel dan track day.', 27)
) as r("author_name", "rating", "quote", "age_days")
where p."is_active" = true
  and not exists (select 1 from "product_reviews" existing where existing."product_id" = p."id");
