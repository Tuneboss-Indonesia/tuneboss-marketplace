create table if not exists "admin_audit_logs" (
  "id" uuid primary key default gen_random_uuid(),
  "actor_id" text references "user"("id") on delete set null,
  "action" text not null,
  "target_id" text not null default '',
  "target_type" text not null,
  "payload" jsonb not null default '{}'::jsonb,
  "created_at" timestamp not null default now()
);
