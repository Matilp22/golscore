create table if not exists public.football_standings_cache (
  id uuid primary key default gen_random_uuid(),
  league_external_id text not null,
  season integer not null,
  group_name text not null,
  payload jsonb not null,
  source text not null default 'api-football',
  synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint football_standings_cache_unique unique (league_external_id, season, group_name)
);

create index if not exists football_standings_cache_lookup_idx
  on public.football_standings_cache (league_external_id, season);

alter table public.football_standings_cache
  add column if not exists source text not null default 'api-football',
  add column if not exists synced_at timestamptz not null default timezone('utc', now());

alter table public.football_standings_cache enable row level security;

grant select, insert, update, delete on public.football_standings_cache to service_role;

drop trigger if exists football_standings_cache_set_updated_at on public.football_standings_cache;
create trigger football_standings_cache_set_updated_at
before update on public.football_standings_cache
for each row
execute function public.touch_updated_at();
