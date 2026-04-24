-- Reparacion segura para la contaminacion de rounds de Liga Profesional Argentina.
-- Causa: rounds compuestos como "Regular Season - 1" y otra fase "... - 1"
-- fueron colapsados al mismo valor numerico "1".
-- No hay duplicados por external_id; el problema es semantico en public.matches.round.

-- 1) Auditoria previa.
select
  l.external_id as league_external_id,
  m.round,
  count(*) as match_count
from public.matches m
join public.leagues l on l.id = m.league_id
where l.external_id::text = '128'
group by l.external_id, m.round
order by m.round::text;

-- 2) Limpieza segura: resetea solo los rounds numericos inflados de Liga Profesional.
-- No borra partidos ni toca predictions/auth.
begin;

update public.matches m
set round = null
from public.leagues l
where l.id = m.league_id
  and l.external_id::text = '128'
  and m.round in ('1', '2', '3', '4');

commit;

-- 3) Verificacion: deberian quedar en null hasta reejecutar el sync corregido.
select
  l.external_id as league_external_id,
  m.round,
  count(*) as match_count
from public.matches m
join public.leagues l on l.id = m.league_id
where l.external_id::text = '128'
group by l.external_id, m.round
order by m.round nulls first, m.round::text;

-- 4) Despues de correr de nuevo /api/admin/sync-matches?competition=liga-profesional-argentina
-- volver a ejecutar:
select
  m.round,
  count(*) as match_count
from public.matches m
join public.leagues l on l.id = m.league_id
where l.external_id::text = '128'
group by m.round
order by m.round;
