-- Mirror the device-side PIN hash into a server-side table so the
-- reset-password-with-pin edge function can verify it independently.
create table if not exists public.user_pin_recovery (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

-- Row-Level Security: users can read/write only their own row.
alter table public.user_pin_recovery enable row level security;

create policy "pin_recovery_select_own"
  on public.user_pin_recovery for select
  using (auth.uid() = user_id);

create policy "pin_recovery_upsert_own"
  on public.user_pin_recovery for insert
  with check (auth.uid() = user_id);

create policy "pin_recovery_update_own"
  on public.user_pin_recovery for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "pin_recovery_delete_own"
  on public.user_pin_recovery for delete
  using (auth.uid() = user_id);

-- Rate-limit tracking (written only by service_role via the edge function).
create table if not exists public.password_reset_audit (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip_address text,
  user_agent text,
  outcome text not null check (outcome in ('success','bad_pin','no_pin','bad_email','rate_limited')),
  created_at timestamptz not null default now()
);

create index if not exists idx_pra_email_created
  on public.password_reset_audit (email, created_at desc);

create index if not exists idx_pra_ip_created
  on public.password_reset_audit (ip_address, created_at desc);