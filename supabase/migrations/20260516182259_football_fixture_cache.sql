create table if not exists public.football_fixture_cache (
  id uuid primary key default gen_random_uuid(),
  date text not null,
  league_external_id text,
  fixture_external_id text not null,
  payload jsonb not null,
  normalized_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint football_fixture_cache_date_fixture_key unique (date, fixture_external_id)
);

create index if not exists idx_football_fixture_cache_date
on public.football_fixture_cache (date);

create index if not exists idx_football_fixture_cache_league_date
on public.football_fixture_cache (league_external_id, date);

drop trigger if exists football_fixture_cache_touch_updated_at
on public.football_fixture_cache;

create trigger football_fixture_cache_touch_updated_at
before update on public.football_fixture_cache
for each row execute function public.touch_updated_at();

alter table public.football_fixture_cache enable row level security;

grant select, insert, update, delete on table public.football_fixture_cache to service_role;
