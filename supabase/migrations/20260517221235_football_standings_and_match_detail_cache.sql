create table if not exists public.football_standings_cache (
  id uuid primary key default gen_random_uuid(),
  league_external_id text not null,
  season integer not null,
  group_name text not null,
  payload jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint football_standings_cache_unique unique (league_external_id, season, group_name)
);

create index if not exists idx_football_standings_cache_league_season
on public.football_standings_cache (league_external_id, season);

alter table public.football_standings_cache enable row level security;

grant select, insert, update, delete on table public.football_standings_cache to service_role;

drop trigger if exists football_standings_cache_touch_updated_at
on public.football_standings_cache;

create trigger football_standings_cache_touch_updated_at
before update on public.football_standings_cache
for each row execute function public.touch_updated_at();

create table if not exists public.football_match_detail_cache (
  id uuid primary key default gen_random_uuid(),
  fixture_external_id text not null,
  match_id text,
  league_external_id text,
  season integer,
  fixture_payload jsonb,
  events jsonb not null default '[]'::jsonb,
  lineups jsonb not null default '[]'::jsonb,
  statistics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint football_match_detail_cache_fixture_unique unique (fixture_external_id)
);

create index if not exists idx_football_match_detail_cache_match_id
on public.football_match_detail_cache (match_id);

create index if not exists idx_football_match_detail_cache_league
on public.football_match_detail_cache (league_external_id, season);

alter table public.football_match_detail_cache enable row level security;

grant select, insert, update, delete on table public.football_match_detail_cache to service_role;

drop trigger if exists football_match_detail_cache_touch_updated_at
on public.football_match_detail_cache;

create trigger football_match_detail_cache_touch_updated_at
before update on public.football_match_detail_cache
for each row execute function public.touch_updated_at();
