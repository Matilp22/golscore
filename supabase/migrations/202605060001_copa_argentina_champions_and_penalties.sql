alter table public.matches
  add column if not exists home_penalty_score integer,
  add column if not exists away_penalty_score integer;

alter table public.matches
  drop constraint if exists matches_penalty_scores_non_negative;

alter table public.matches
  add constraint matches_penalty_scores_non_negative check (
    (home_penalty_score is null or home_penalty_score >= 0) and
    (away_penalty_score is null or away_penalty_score >= 0)
  );

create table if not exists public.copa_argentina_champions (
  id uuid primary key default gen_random_uuid(),
  season integer not null,
  champion_team_id uuid references public.teams(id) on delete set null,
  runner_up_team_id uuid references public.teams(id) on delete set null,
  champion_name text not null,
  runner_up_name text not null,
  final_score text not null,
  final_match_id uuid references public.matches(id) on delete set null,
  venue text,
  created_at timestamptz not null default now(),
  unique (season)
);

alter table public.copa_argentina_champions enable row level security;

drop policy if exists "public_read_copa_argentina_champions"
on public.copa_argentina_champions;

create policy "public_read_copa_argentina_champions"
on public.copa_argentina_champions
for select
to anon, authenticated
using (true);

create index if not exists idx_copa_argentina_champions_season
on public.copa_argentina_champions (season desc);

insert into public.copa_argentina_champions (
  season,
  champion_team_id,
  runner_up_team_id,
  champion_name,
  runner_up_name,
  final_score,
  venue
)
values
  (
    1969,
    (select id from public.teams where lower(name) = 'boca juniors' limit 1),
    (select id from public.teams where lower(name) = 'atlanta' limit 1),
    'Boca Juniors',
    'Atlanta',
    '3-1 / 0-1',
    null
  ),
  (
    2025,
    (select id from public.teams where lower(name) in ('independiente rivadavia', 'independiente rivadavia de mendoza') limit 1),
    (select id from public.teams where lower(name) = 'argentinos juniors' limit 1),
    'Independiente Rivadavia',
    'Argentinos Juniors',
    '2-2 (5-3 pen.)',
    'Estadio Monumental Presidente Peron, Cordoba'
  ),
  (
    2024,
    (select id from public.teams where lower(name) in ('central cordoba', 'central cordoba (sde)', 'central cordoba sde') limit 1),
    (select id from public.teams where lower(name) in ('velez sarsfield', 'vélez sarsfield') limit 1),
    'Central Cordoba (SdE)',
    'Velez Sarsfield',
    '1-0',
    'Estadio 15 de Abril, Santa Fe'
  ),
  (
    2023,
    (select id from public.teams where lower(name) in ('estudiantes', 'estudiantes l.p.', 'estudiantes de la plata') limit 1),
    (select id from public.teams where lower(name) = 'defensa y justicia' limit 1),
    'Estudiantes (LP)',
    'Defensa y Justicia',
    '1-0',
    'Estadio Ciudad de Lanus'
  ),
  (
    2022,
    (select id from public.teams where lower(name) = 'patronato' limit 1),
    (select id from public.teams where lower(name) in ('talleres cordoba', 'talleres de cordoba') limit 1),
    'Patronato',
    'Talleres de Cordoba',
    '1-0',
    'Estadio Malvinas Argentinas, Mendoza'
  ),
  (
    2021,
    (select id from public.teams where lower(name) = 'boca juniors' limit 1),
    (select id from public.teams where lower(name) in ('talleres cordoba', 'talleres de cordoba') limit 1),
    'Boca Juniors',
    'Talleres de Cordoba',
    '0-0 (5-4 pen.)',
    'Estadio Madre de Ciudades, Santiago del Estero'
  ),
  (
    2019,
    (select id from public.teams where lower(name) = 'river plate' limit 1),
    (select id from public.teams where lower(name) in ('central cordoba', 'central cordoba (sde)', 'central cordoba sde') limit 1),
    'River Plate',
    'Central Cordoba (SdE)',
    '3-0',
    'Estadio Malvinas Argentinas, Mendoza'
  ),
  (
    2018,
    (select id from public.teams where lower(name) = 'rosario central' limit 1),
    (select id from public.teams where lower(name) in ('gimnasia', 'gimnasia (lp)', 'gimnasia la plata') limit 1),
    'Rosario Central',
    'Gimnasia (LP)',
    '1-1 (4-1 pen.)',
    'Estadio Malvinas Argentinas, Mendoza'
  ),
  (
    2017,
    (select id from public.teams where lower(name) = 'river plate' limit 1),
    (select id from public.teams where lower(name) in ('atletico tucuman', 'atlético tucumán') limit 1),
    'River Plate',
    'Atletico Tucuman',
    '2-1',
    'Estadio Malvinas Argentinas, Mendoza'
  ),
  (
    2016,
    (select id from public.teams where lower(name) = 'river plate' limit 1),
    (select id from public.teams where lower(name) = 'rosario central' limit 1),
    'River Plate',
    'Rosario Central',
    '4-3',
    'Estadio Mario Alberto Kempes, Cordoba'
  ),
  (
    2015,
    (select id from public.teams where lower(name) = 'boca juniors' limit 1),
    (select id from public.teams where lower(name) = 'rosario central' limit 1),
    'Boca Juniors',
    'Rosario Central',
    '2-0',
    'Estadio Mario Alberto Kempes, Cordoba'
  ),
  (
    2014,
    (select id from public.teams where lower(name) = 'huracan' limit 1),
    (select id from public.teams where lower(name) = 'rosario central' limit 1),
    'Huracan',
    'Rosario Central',
    '0-0 (5-4 pen.)',
    'Estadio San Juan del Bicentenario'
  ),
  (
    2013,
    (select id from public.teams where lower(name) = 'arsenal' limit 1),
    (select id from public.teams where lower(name) = 'san lorenzo' limit 1),
    'Arsenal',
    'San Lorenzo',
    '3-0',
    'Estadio Bicentenario Ciudad de Catamarca'
  ),
  (
    2012,
    (select id from public.teams where lower(name) = 'boca juniors' limit 1),
    (select id from public.teams where lower(name) = 'racing club' limit 1),
    'Boca Juniors',
    'Racing Club',
    '2-1',
    'Estadio San Juan del Bicentenario'
  )
on conflict (season) do update set
  champion_team_id = coalesce(excluded.champion_team_id, public.copa_argentina_champions.champion_team_id),
  runner_up_team_id = coalesce(excluded.runner_up_team_id, public.copa_argentina_champions.runner_up_team_id),
  champion_name = excluded.champion_name,
  runner_up_name = excluded.runner_up_name,
  final_score = excluded.final_score,
  venue = excluded.venue;
