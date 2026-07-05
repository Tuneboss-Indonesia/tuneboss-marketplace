create table if not exists "password_reset_tokens" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" text not null references "user"("id") on delete cascade,
  "token_hash" text not null,
  "expires_at" timestamp not null,
  "used_at" timestamp,
  "created_at" timestamp not null default now()
);
