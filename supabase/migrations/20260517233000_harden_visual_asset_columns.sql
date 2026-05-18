alter table public.teams
  add column if not exists logo_url text,
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

alter table public.players
  add column if not exists external_id text,
  add column if not exists name text,
  add column if not exists team_id uuid references public.teams(id) on delete set null,
  add column if not exists team_external_id text,
  add column if not exists number integer,
  add column if not exists position text,
  add column if not exists photo_url text,
  add column if not exists photo_source text,
  add column if not exists photo_last_synced_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists players_external_id_key
  on public.players(external_id)
  where external_id is not null;

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
  'Canonical team crest URL used by Hay Fulbo. Frontend reads this through shared asset helpers.';
comment on column public.leagues.logo_url is
  'Canonical league or cup logo URL used by Hay Fulbo. Frontend reads this through shared asset helpers.';
comment on column public.players.photo_url is
  'Canonical player photo URL used by Hay Fulbo where player photos are appropriate.';
