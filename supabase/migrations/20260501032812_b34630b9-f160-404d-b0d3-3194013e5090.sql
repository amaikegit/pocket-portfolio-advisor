
-- Extensions for scheduling
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) telegram_links: per-user link to a Telegram chat
create table public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  chat_id bigint not null unique,
  username text,
  first_name text,
  alerts_enabled boolean not null default true,
  reports_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_links enable row level security;

create policy "Users can view own telegram link"
  on public.telegram_links for select
  using (auth.uid() = user_id);

create policy "Users can insert own telegram link"
  on public.telegram_links for insert
  with check (auth.uid() = user_id);

create policy "Users can update own telegram link"
  on public.telegram_links for update
  using (auth.uid() = user_id);

create policy "Users can delete own telegram link"
  on public.telegram_links for delete
  using (auth.uid() = user_id);

create trigger trg_telegram_links_updated_at
before update on public.telegram_links
for each row execute function public.update_updated_at_column();

-- 2) telegram_link_codes: 6-digit temporary codes to bind a chat to a user
create table public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_telegram_link_codes_user on public.telegram_link_codes(user_id);
create index idx_telegram_link_codes_code on public.telegram_link_codes(code);

alter table public.telegram_link_codes enable row level security;

create policy "Users can view own link codes"
  on public.telegram_link_codes for select
  using (auth.uid() = user_id);

create policy "Users can insert own link codes"
  on public.telegram_link_codes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own link codes"
  on public.telegram_link_codes for delete
  using (auth.uid() = user_id);

-- 3) telegram_bot_state: singleton for getUpdates offset
create table public.telegram_bot_state (
  id int primary key check (id = 1),
  update_offset bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.telegram_bot_state (id, update_offset) values (1, 0);

alter table public.telegram_bot_state enable row level security;
-- No policies => only service_role can access

-- 4) telegram_outbox: pending messages queue
create table public.telegram_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  chat_id bigint not null,
  text text not null,
  parse_mode text default 'HTML',
  status text not null default 'pending', -- pending | sent | failed
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index idx_telegram_outbox_status on public.telegram_outbox(status, created_at);
create index idx_telegram_outbox_user on public.telegram_outbox(user_id);

alter table public.telegram_outbox enable row level security;

create policy "Users can view own outbox"
  on public.telegram_outbox for select
  using (auth.uid() = user_id);
-- inserts/updates done via service_role
