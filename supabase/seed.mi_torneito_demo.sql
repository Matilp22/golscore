-- Seed opcional de desarrollo para Mi Torneito.
-- Ejecutar manualmente solo en local/desarrollo despues de aplicar la migracion.

with org as (
  insert into public.mi_torneito_organizations (name, slug, city, contact_email, active)
  values ('Liga Demo Hay Fulbo', 'liga-demo-hay-fulbo', 'Buenos Aires', 'demo@hayfulbo.com', true)
  on conflict (slug) do update set name = excluded.name
  returning id
),
tournament as (
  insert into public.mi_torneito_tournaments (
    organization_id,
    name,
    slug,
    short_description,
    city,
    venue,
    season,
    format,
    status,
    visibility,
    starts_on
  )
  select
    org.id,
    'Copa Demo del Barrio',
    'copa-demo-del-barrio',
    'Torneo demo para probar Mi Torneito con fixture, tabla y resultados.',
    'Buenos Aires',
    'Complejo HF',
    '2026',
    'Todos contra todos',
    'active',
    'public',
    current_date
  from org
  on conflict (slug) do update set name = excluded.name
  returning id
),
round_one as (
  insert into public.mi_torneito_rounds (tournament_id, name, slug, phase, sort_order)
  select tournament.id, 'Fecha 1', 'fecha-1', 'group', 1
  from tournament
  on conflict (tournament_id, slug) do update set name = excluded.name
  returning id, tournament_id
),
teams as (
  insert into public.mi_torneito_teams (tournament_id, name, slug, primary_color, home_venue)
  select tournament.id, team.name, team.slug, team.color, 'Complejo HF'
  from tournament
  cross join (
    values
      ('Los Pibes FC', 'los-pibes-fc', '#58c91f'),
      ('La Banda', 'la-banda', '#071b2f'),
      ('Norte Unido', 'norte-unido', '#f02d3a'),
      ('Barrio Sur', 'barrio-sur', '#0b2742')
  ) as team(name, slug, color)
  on conflict (tournament_id, slug) do update set name = excluded.name
  returning id, tournament_id, slug
)
insert into public.mi_torneito_matches (
  tournament_id,
  round_id,
  home_team_id,
  away_team_id,
  scheduled_at,
  venue,
  status,
  home_score,
  away_score,
  broadcast_label
)
select
  round_one.tournament_id,
  round_one.id,
  home.id,
  away.id,
  now() + interval '2 days',
  'Cancha 1',
  'scheduled',
  null,
  null,
  'TV no confirmada'
from round_one
join teams home on home.tournament_id = round_one.tournament_id and home.slug = 'los-pibes-fc'
join teams away on away.tournament_id = round_one.tournament_id and away.slug = 'la-banda'
where not exists (
  select 1
  from public.mi_torneito_matches m
  where m.tournament_id = round_one.tournament_id
    and m.home_team_id = home.id
    and m.away_team_id = away.id
);
