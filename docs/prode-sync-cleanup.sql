-- Limpieza segura previa al sync real del prode.
-- Ejecutar en Supabase SQL Editor y revisar primero los SELECT de auditoria.
-- El modelo runtime oficial usa solo public.leagues, public.teams y public.matches.

-- Auditoria: ligas fuera del alcance oficial o con external_id incorrecto.
select id, external_id, name, country, season
from public.leagues
where (external_id is null or external_id::text <> all (array['128', '129', '1']))
   or season is distinct from 2026
order by name, external_id nulls last;

-- Auditoria: partidos fuera de las 3 ligas oficiales.
select m.id, m.external_id, m.league_id, l.external_id as league_external_id, l.name as league_name
from public.matches m
left join public.leagues l on l.id = m.league_id
where l.id is null
   or l.external_id is null
   or l.external_id::text <> all (array['128', '129', '1'])
   or l.season is distinct from 2026
order by m.match_date nulls last;

-- Auditoria: equipos huerfanos, tipicos de un sync que guardo teams pero fallo en matches.
select t.id, t.external_id, t.name
from public.teams t
where not exists (select 1 from public.matches m where m.home_team_id = t.id)
  and not exists (select 1 from public.matches m where m.away_team_id = t.id)
order by t.name;

begin;

-- Asegura las 3 ligas canonicas. Primera Nacional en API-Football es external_id 129.
insert into public.leagues (external_id, name, country, season)
values
  (128, 'Liga Profesional Argentina', 'Argentina', 2026),
  (129, 'Primera B Nacional', 'Argentina', 2026),
  (1, 'Mundial 2026', 'World', 2026)
on conflict (external_id) do update set
  name = excluded.name,
  country = excluded.country,
  season = excluded.season;

-- Borra partidos claramente fuera del alcance oficial, siempre que no tengan predicciones.
delete from public.matches m
where not exists (
    select 1
    from public.leagues l
    where l.id = m.league_id
      and l.external_id::text in ('128', '129', '1')
      and l.season = 2026
  )
  and not exists (
    select 1
    from public.predictions p
    where p.match_id = m.id
  );

-- Borra ligas no oficiales que ya no tienen partidos asociados.
delete from public.leagues l
where not (l.external_id::text in ('128', '129', '1') and l.season = 2026)
  and not exists (
    select 1
    from public.matches m
    where m.league_id = l.id
  );

-- Borra duplicados manuales por nombre, sin external_id oficial y sin partidos.
delete from public.leagues l
where (
    l.external_id is null
    or l.external_id::text not in ('128', '129', '1')
  )
  and lower(l.name) in (
    'liga profesional argentina',
    'liga profesional',
    'primera b nacional',
    'primera nacional',
    'mundial 2026',
    'world cup 2026'
  )
  and not exists (
    select 1
    from public.matches m
    where m.league_id = l.id
  );

-- Borra equipos huerfanos. El sync real los vuelve a crear solo si aparecen en fixtures oficiales.
delete from public.teams t
where not exists (select 1 from public.matches m where m.home_team_id = t.id)
  and not exists (select 1 from public.matches m where m.away_team_id = t.id);

commit;

-- Validacion posterior: deberian quedar solo 3 ligas visibles para el prode.
select id, external_id, name, country, season
from public.leagues
where external_id::text in ('128', '129', '1')
  and season = 2026
order by external_id;
