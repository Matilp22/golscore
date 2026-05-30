create table if not exists public.conmebol_bracket_series (
  id uuid primary key default gen_random_uuid(),
  competition text not null check (competition in ('libertadores', 'sudamericana')),
  league_id text,
  league_external_id text not null,
  season integer not null,
  phase text not null check (phase in ('playoffs', 'roundOf16', 'quarterFinals', 'semiFinals', 'final')),
  slot integer not null check (slot > 0),
  home_seed text,
  away_seed text,
  team_a_id text,
  team_b_id text,
  source text not null default 'placeholder',
  status text not null default 'A definir',
  leg1_date timestamptz,
  leg2_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_external_id, season, phase, slot)
);

create index if not exists idx_conmebol_bracket_series_competition
on public.conmebol_bracket_series (competition, season, phase, slot);

create index if not exists idx_conmebol_bracket_series_teams
on public.conmebol_bracket_series (team_a_id, team_b_id);

alter table public.conmebol_bracket_series enable row level security;

grant select, insert, update, delete on table public.conmebol_bracket_series to service_role;

drop trigger if exists conmebol_bracket_series_touch_updated_at
on public.conmebol_bracket_series;

create trigger conmebol_bracket_series_touch_updated_at
before update on public.conmebol_bracket_series
for each row execute function public.touch_updated_at();

create table if not exists public.conmebol_bracket_series_matches (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.conmebol_bracket_series(id) on delete cascade,
  match_id text,
  leg integer check (leg is null or leg in (1, 2)),
  created_at timestamptz not null default now(),
  unique (series_id, leg)
);

create index if not exists idx_conmebol_bracket_series_matches_match
on public.conmebol_bracket_series_matches (match_id)
where match_id is not null;

alter table public.conmebol_bracket_series_matches enable row level security;

grant select, insert, update, delete on table public.conmebol_bracket_series_matches to service_role;
