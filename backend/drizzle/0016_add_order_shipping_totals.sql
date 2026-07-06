alter table "orders" add column if not exists "shipping_cost" numeric(12, 2) not null default '0';
alter table "orders" add column if not exists "shipping_method" text not null default 'REGULAR';
