create table if not exists public.team_identity_overrides (
  id uuid primary key default gen_random_uuid(),
  context text,
  source_name text not null,
  canonical_team_id uuid,
  canonical_team_external_id text,
  canonical_team_name text not null,
  country text,
  league_external_id text,
  reason text,
  verified boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists team_identity_overrides_context_source_unique
on public.team_identity_overrides (
  coalesce(context, ''),
  lower(source_name),
  coalesce(league_external_id, '')
);

alter table public.team_identity_overrides enable row level security;

drop policy if exists "public_read_team_identity_overrides" on public.team_identity_overrides;
create policy "public_read_team_identity_overrides"
on public.team_identity_overrides for select
to anon, authenticated
using (verified = true);

grant select on public.team_identity_overrides to anon, authenticated;
grant select, insert, update, delete on public.team_identity_overrides to service_role;

create table if not exists public.world_cup_finals (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  champion_name text not null,
  champion_canonical_name text not null,
  champion_team_id uuid,
  champion_team_external_id text,
  runner_up_name text not null,
  runner_up_canonical_name text not null,
  runner_up_team_id uuid,
  runner_up_team_external_id text,
  score text not null,
  penalties text,
  after_extra_time boolean not null default false,
  decisive_match boolean not null default false,
  venue text,
  city text,
  country text,
  notes text,
  source text not null default 'manual_verified',
  verified boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_world_cup_finals_year
on public.world_cup_finals (year desc);

alter table public.world_cup_finals enable row level security;

drop policy if exists "public_read_world_cup_finals" on public.world_cup_finals;
create policy "public_read_world_cup_finals"
on public.world_cup_finals for select
to anon, authenticated
using (verified = true);

grant select on public.world_cup_finals to anon, authenticated;
grant select, insert, update, delete on public.world_cup_finals to service_role;

create table if not exists public.tournament_champions (
  id uuid primary key default gen_random_uuid(),
  competition_key text not null,
  season text not null,
  champion_name text not null,
  runner_up_name text not null,
  final_score text,
  champion_team_id uuid,
  runner_up_team_id uuid,
  champion_team_external_id text,
  runner_up_team_external_id text,
  final_match_id uuid,
  venue text,
  source text not null default 'manual_verified',
  verified boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_champions_competition_season_unique unique (competition_key, season)
);

alter table public.tournament_champions
  add column if not exists champion_team_external_id text,
  add column if not exists runner_up_team_external_id text,
  add column if not exists source text not null default 'manual_verified',
  add column if not exists verified boolean not null default true;

alter table public.tournament_champions enable row level security;

drop policy if exists "public_read_tournament_champions" on public.tournament_champions;
create policy "public_read_tournament_champions"
on public.tournament_champions for select
to anon, authenticated
using (true);

grant select on public.tournament_champions to anon, authenticated;
grant select, insert, update, delete on public.tournament_champions to service_role;

insert into public.team_identity_overrides (
  context,
  source_name,
  canonical_team_external_id,
  canonical_team_name,
  country,
  league_external_id,
  reason,
  verified
)
values
  (
    'argentina-copa-argentina',
    'Central Córdoba',
    '1065',
    'Central Córdoba de Santiago',
    'Argentina',
    '130',
    'Evitar confusión con Central Córdoba de Rosario/Córdoba en campeones de Copa Argentina.',
    true
  ),
  (
    'argentina-copa-argentina',
    'Central Córdoba (SdE)',
    '1065',
    'Central Córdoba de Santiago',
    'Argentina',
    '130',
    'Alias histórico de Central Córdoba de Santiago del Estero.',
    true
  ),
  (
    'argentina-copa-argentina',
    'Arsenal',
    '459',
    'Arsenal Sarandi',
    'Argentina',
    '130',
    'Evitar confusion con Arsenal FC de Inglaterra en campeones de Copa Argentina.',
    true
  ),
  (
    'internacional-sudamericana',
    'Arsenal',
    '459',
    'Arsenal Sarandi',
    'Argentina',
    '11',
    'Campeon Sudamericana 2007: Arsenal de Sarandi.',
    true
  ),
  (
    'internacional-champions',
    'Arsenal',
    '42',
    'Arsenal',
    'England',
    '2',
    'Finalista de UEFA Champions League: Arsenal FC de Inglaterra.',
    true
  ),
  (
    'internacional-europa-league',
    'Arsenal',
    '42',
    'Arsenal',
    'England',
    '3',
    'Finalista de UEFA Europa League: Arsenal FC de Inglaterra.',
    true
  ),
  (
    'internacional-champions',
    'Inter',
    '505',
    'Inter',
    'Italy',
    '2',
    'Evitar confusion con otros equipos llamados Inter.',
    true
  ),
  (
    'internacional-europa-league',
    'Inter',
    '505',
    'Inter',
    'Italy',
    '3',
    'Evitar confusion con otros equipos llamados Inter.',
    true
  ),
  (
    'internacional-champions',
    'Juventus',
    '496',
    'Juventus',
    'Italy',
    '2',
    'Evitar confusion con otros equipos llamados Juventus.',
    true
  ),
  (
    'internacional-champions',
    'Tottenham Hotspur',
    '47',
    'Tottenham',
    'England',
    '2',
    'Alias UEFA para Tottenham Hotspur.',
    true
  ),
  (
    'internacional-europa-league',
    'Tottenham Hotspur',
    '47',
    'Tottenham',
    'England',
    '3',
    'Alias UEFA para Tottenham Hotspur.',
    true
  ),
  (
    'internacional-europa-league',
    'Juventus',
    '496',
    'Juventus',
    'Italy',
    '3',
    'Evitar confusion con otros equipos llamados Juventus.',
    true
  ),
  (
    'internacional-champions',
    'Paris Saint Germain',
    '85',
    'Paris Saint Germain',
    'France',
    '2',
    'Alias sin guion del Paris Saint-Germain.',
    true
  )
on conflict do nothing;

insert into public.tournament_champions (
  competition_key,
  season,
  champion_name,
  runner_up_name,
  final_score,
  champion_team_external_id,
  runner_up_team_external_id,
  venue,
  source,
  verified
)
values
  (
    'internacional-champions',
    '2025/26',
    'Paris Saint Germain',
    'Arsenal',
    '1-1 (4-3 pen.)',
    '85',
    '42',
    'Budapest, Hungría',
    'manual_verified',
    true
  ),
  (
    'internacional-champions',
    '2024/25',
    'Paris Saint Germain',
    'Inter',
    '5-0',
    '85',
    '505',
    'Múnich, Alemania',
    'manual_verified',
    true
  )
on conflict (competition_key, season) do update set
  champion_name = excluded.champion_name,
  runner_up_name = excluded.runner_up_name,
  final_score = excluded.final_score,
  champion_team_external_id = excluded.champion_team_external_id,
  runner_up_team_external_id = excluded.runner_up_team_external_id,
  venue = excluded.venue,
  source = excluded.source,
  verified = excluded.verified,
  updated_at = now();

insert into public.world_cup_finals (
  year,
  champion_name,
  champion_canonical_name,
  champion_team_external_id,
  runner_up_name,
  runner_up_canonical_name,
  runner_up_team_external_id,
  score,
  penalties,
  after_extra_time,
  decisive_match,
  venue,
  city,
  country,
  notes,
  source,
  verified
)
values
  (1930, 'Uruguay', 'Uruguay', '7', 'Argentina', 'Argentina', '26', '4-2', null, false, false, 'Estadio Centenario', 'Montevideo', 'Uruguay', null, 'manual_verified', true),
  (1934, 'Italia', 'Italia', '768', 'Checoslovaquia', 'Checoslovaquia', null, '2-1', null, true, false, 'Stadio Nazionale PNF', 'Roma', 'Italia', 'a.e.t.', 'manual_verified', true),
  (1938, 'Italia', 'Italia', '768', 'Hungría', 'Hungría', '769', '4-2', null, false, false, 'Stade Olympique de Colombes', 'Colombes', 'Francia', null, 'manual_verified', true),
  (1950, 'Uruguay', 'Uruguay', '7', 'Brasil', 'Brasil', '6', '2-1', null, false, true, 'Maracana', 'Rio de Janeiro', 'Brasil', 'partido decisivo', 'manual_verified', true),
  (1954, 'Alemania Federal', 'Alemania', '25', 'Hungría', 'Hungría', '769', '3-2', null, false, false, 'Wankdorfstadion', 'Berna', 'Suiza', 'Alemania Federal cuenta como Alemania.', 'manual_verified', true),
  (1958, 'Brasil', 'Brasil', '6', 'Suecia', 'Suecia', '21', '5-2', null, false, false, 'Rasunda Stadium', 'Solna', 'Suecia', null, 'manual_verified', true),
  (1962, 'Brasil', 'Brasil', '6', 'Checoslovaquia', 'Checoslovaquia', null, '3-1', null, false, false, 'Estadio Nacional', 'Santiago', 'Chile', null, 'manual_verified', true),
  (1966, 'Inglaterra', 'Inglaterra', '10', 'Alemania Federal', 'Alemania', '25', '4-2', null, true, false, 'Wembley Stadium', 'Londres', 'Inglaterra', 'a.e.t.', 'manual_verified', true),
  (1970, 'Brasil', 'Brasil', '6', 'Italia', 'Italia', '768', '4-1', null, false, false, 'Estadio Azteca', 'Ciudad de México', 'México', null, 'manual_verified', true),
  (1974, 'Alemania Federal', 'Alemania', '25', 'Países Bajos', 'Países Bajos', '1118', '2-1', null, false, false, 'Olympiastadion', 'Múnich', 'Alemania', 'Alemania Federal cuenta como Alemania.', 'manual_verified', true),
  (1978, 'Argentina', 'Argentina', '26', 'Países Bajos', 'Países Bajos', '1118', '3-1', null, true, false, 'Estadio Monumental', 'Buenos Aires', 'Argentina', 't.e.', 'manual_verified', true),
  (1982, 'Italia', 'Italia', '768', 'Alemania Federal', 'Alemania', '25', '3-1', null, false, false, 'Santiago Bernabéu', 'Madrid', 'España', 'Alemania Federal cuenta como Alemania.', 'manual_verified', true),
  (1986, 'Argentina', 'Argentina', '26', 'Alemania Federal', 'Alemania', '25', '3-2', null, false, false, 'Estadio Azteca', 'Ciudad de México', 'México', 'Alemania Federal cuenta como Alemania.', 'manual_verified', true),
  (1990, 'Alemania', 'Alemania', '25', 'Argentina', 'Argentina', '26', '1-0', null, false, false, 'Stadio Olimpico', 'Roma', 'Italia', null, 'manual_verified', true),
  (1994, 'Brasil', 'Brasil', '6', 'Italia', 'Italia', '768', '0-0', 'Brasil 3-2 Italia', false, false, 'Rose Bowl', 'Pasadena', 'Estados Unidos', 'penales', 'manual_verified', true),
  (1998, 'Francia', 'Francia', '2', 'Brasil', 'Brasil', '6', '3-0', null, false, false, 'Stade de France', 'Saint-Denis', 'Francia', null, 'manual_verified', true),
  (2002, 'Brasil', 'Brasil', '6', 'Alemania', 'Alemania', '25', '2-0', null, false, false, 'International Stadium', 'Yokohama', 'Japón', null, 'manual_verified', true),
  (2006, 'Italia', 'Italia', '768', 'Francia', 'Francia', '2', '1-1', 'Italia 5-3 Francia', false, false, 'Olympiastadion', 'Berlín', 'Alemania', 'penales', 'manual_verified', true),
  (2010, 'España', 'España', '9', 'Países Bajos', 'Países Bajos', '1118', '1-0', null, true, false, 'Soccer City', 'Johannesburgo', 'Sudáfrica', 't.e.', 'manual_verified', true),
  (2014, 'Alemania', 'Alemania', '25', 'Argentina', 'Argentina', '26', '1-0', null, true, false, 'Maracana', 'Rio de Janeiro', 'Brasil', 'a.e.t.', 'manual_verified', true),
  (2018, 'Francia', 'Francia', '2', 'Croacia', 'Croacia', '3', '4-2', null, false, false, 'Luzhniki Stadium', 'Moscú', 'Rusia', null, 'manual_verified', true),
  (2022, 'Argentina', 'Argentina', '26', 'Francia', 'Francia', '2', '3-3', 'Argentina 4-2 Francia', false, false, 'Lusail Stadium', 'Lusail', 'Qatar', 'penales', 'manual_verified', true)
on conflict (year) do update set
  champion_name = excluded.champion_name,
  champion_canonical_name = excluded.champion_canonical_name,
  champion_team_external_id = excluded.champion_team_external_id,
  runner_up_name = excluded.runner_up_name,
  runner_up_canonical_name = excluded.runner_up_canonical_name,
  runner_up_team_external_id = excluded.runner_up_team_external_id,
  score = excluded.score,
  penalties = excluded.penalties,
  after_extra_time = excluded.after_extra_time,
  decisive_match = excluded.decisive_match,
  venue = excluded.venue,
  city = excluded.city,
  country = excluded.country,
  notes = excluded.notes,
  source = excluded.source,
  verified = excluded.verified,
  updated_at = now();
