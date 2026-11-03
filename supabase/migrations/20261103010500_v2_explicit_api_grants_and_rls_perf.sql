-- Restablecer permisos explícitos: el proyecto nuevo tiene "automatically expose new tables" deshabilitado.
-- RLS controla qué filas se leen y escriben; GRANT determina si la API puede acceder.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Marcadores y catálogos con política pública de lectura.
grant select on public.competitions,public.leagues,public.teams,public.matches,
  public.results,public.players,public.copa_argentina_champions,
  public.leaderboards to anon, authenticated;

-- Datos personales: sólo usuarios autenticados y sujetos a RLS por propietario.
grant select,insert,update on public.profiles,public.predictions to authenticated;
grant select on public.points,public.prediction_scores to authenticated;
grant select,insert,delete on public.user_favorite_leagues to authenticated;
grant select,insert,update on public.prode_private_tournaments,public.prode_private_tournament_join_requests to authenticated;
grant select,insert,delete on public.prode_private_tournament_members to authenticated;
grant select,insert,update on public.pwa_push_subscriptions to authenticated;

-- Mi Torneito: la solicitud pública está protegida por RLS (status=pending).
grant insert on public.mi_torneito_tournament_requests to anon,authenticated;
-- La gestión de torneos y los controles de administrador se realizan server-side.

-- Endurecer patrones antiguos (sin cambiar la semántica de sus políticas).
do $$
declare p record;
declare statement text;
begin
  for p in
    select schemaname,tablename,policyname,qual,with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual,'') like '%auth.uid()%' or coalesce(with_check,'') like '%auth.uid()%')
  loop
    statement := format('alter policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
    if p.qual is not null then
      statement := statement || ' using (' || replace(p.qual,'auth.uid()','(select auth.uid())') || ')';
    end if;
    if p.with_check is not null then
      statement := statement || ' with check (' || replace(p.with_check,'auth.uid()','(select auth.uid())') || ')';
    end if;
    execute statement;
  end loop;
end $$;
