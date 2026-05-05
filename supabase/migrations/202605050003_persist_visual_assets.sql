alter table public.teams
  add column if not exists logo_source text,
  add column if not exists logo_last_synced_at timestamptz;

alter table public.leagues
  add column if not exists logo_url text,
  add column if not exists logo_source text,
  add column if not exists logo_last_synced_at timestamptz;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text,
  team_id uuid references public.teams(id) on delete set null,
  team_external_id text,
  number integer,
  position text,
  photo_url text,
  photo_source text,
  photo_last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists players_team_id_idx on public.players(team_id);
create index if not exists players_team_external_id_idx on public.players(team_external_id);
create index if not exists players_name_idx on public.players(name);

alter table public.players enable row level security;

drop policy if exists "public_read_players" on public.players;
create policy "public_read_players"
on public.players for select
to anon, authenticated
using (true);

comment on column public.teams.logo_url is
  'Stable team crest URL used by the app. Populated from API-Football/API-Sports or future asset cache.';
comment on column public.leagues.logo_url is
  'Stable league logo URL used by the app. Populated from API-Football/API-Sports or future asset cache.';
comment on column public.players.photo_url is
  'Stable player photo URL used by the app. Populated from API-Football/API-Sports or future asset cache.';
