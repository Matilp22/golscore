do $$
declare
  pair record;
begin
  for pair in
    select *
    from (
      values
        ('perfiles', 'profiles'),
        ('ligas', 'leagues'),
        ('equipos', 'teams'),
        ('partidos', 'matches'),
        ('predicciones', 'predictions'),
        ('puntos', 'points')
    ) as pairs(spanish_name, english_name)
  loop
    if to_regclass('public.' || pair.spanish_name) is not null
      and to_regclass('public.' || pair.english_name) is null then
      execute format('alter table public.%I rename to %I', pair.spanish_name, pair.english_name);
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.ligas') is not null and to_regclass('public.leagues') is not null then
    insert into public.leagues
    select * from public.ligas
    on conflict (id) do nothing;
  end if;

  if to_regclass('public.equipos') is not null and to_regclass('public.teams') is not null then
    insert into public.teams
    select * from public.equipos
    on conflict (id) do nothing;
  end if;

  if to_regclass('public.partidos') is not null and to_regclass('public.matches') is not null then
    insert into public.matches
    select * from public.partidos
    on conflict (id) do nothing;
  end if;

  if to_regclass('public.predicciones') is not null and to_regclass('public.predictions') is not null then
    insert into public.predictions
    select * from public.predicciones
    on conflict (id) do nothing;
  end if;

  if to_regclass('public.puntos') is not null and to_regclass('public.points') is not null then
    insert into public.points
    select * from public.puntos
    on conflict (id) do nothing;
  end if;
end $$;

do $$
begin
  if to_regclass('public.matches') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'matches'
        and column_name = 'starts_at'
    )
    and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'matches'
        and column_name = 'match_date'
    ) then
    alter table public.matches rename column starts_at to match_date;
  end if;

  if to_regclass('public.predictions') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'predictions'
        and column_name = 'home_score_pred'
    )
    and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'predictions'
        and column_name = 'predicted_home_score'
    ) then
    alter table public.predictions rename column home_score_pred to predicted_home_score;
  end if;

  if to_regclass('public.predictions') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'predictions'
        and column_name = 'away_score_pred'
    )
    and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'predictions'
        and column_name = 'predicted_away_score'
    ) then
    alter table public.predictions rename column away_score_pred to predicted_away_score;
  end if;
end $$;

create index if not exists idx_matches_match_date on public.matches(match_date);

create or replace function public.prevent_locked_prediction()
returns trigger
language plpgsql
as $$
declare
  match_start timestamptz;
begin
  select match_date into match_start
  from public.matches
  where id = new.match_id;

  if match_start is null then
    raise exception 'Partido no encontrado';
  end if;

  if now() >= match_start - interval '15 minutes' then
    raise exception 'La prediccion ya esta bloqueada';
  end if;

  return new;
end;
$$;

create or replace function public.recalculate_prediction_scores(target_match_id bigint default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.prediction_scores (
    prediction_id,
    user_id,
    match_id,
    points,
    exact_hit,
    partial_hit,
    calculated_at
  )
  select
    p.id,
    p.user_id,
    p.match_id,
    case
      when p.predicted_home_score = coalesce(r.home_score, m.home_score)
        and p.predicted_away_score = coalesce(r.away_score, m.away_score) then 3
      when sign(p.predicted_home_score - p.predicted_away_score) =
        sign(coalesce(r.home_score, m.home_score) - coalesce(r.away_score, m.away_score)) then 1
      else 0
    end,
    (
      p.predicted_home_score = coalesce(r.home_score, m.home_score)
      and p.predicted_away_score = coalesce(r.away_score, m.away_score)
    ),
    (
      sign(p.predicted_home_score - p.predicted_away_score) =
        sign(coalesce(r.home_score, m.home_score) - coalesce(r.away_score, m.away_score))
      and not (
        p.predicted_home_score = coalesce(r.home_score, m.home_score)
        and p.predicted_away_score = coalesce(r.away_score, m.away_score)
      )
    ),
    now()
  from public.predictions p
  join public.matches m on m.id = p.match_id
  left join public.results r on r.match_id = m.id
  where coalesce(r.status, m.status) in ('final', 'FT', 'AET', 'PEN')
    and coalesce(r.home_score, m.home_score) is not null
    and coalesce(r.away_score, m.away_score) is not null
    and (target_match_id is null or p.match_id = target_match_id)
  on conflict (prediction_id) do update set
    points = excluded.points,
    exact_hit = excluded.exact_hit,
    partial_hit = excluded.partial_hit,
    calculated_at = excluded.calculated_at;

  insert into public.points (
    prediction_id,
    user_id,
    match_id,
    points,
    exact_hit,
    partial_hit,
    calculated_at
  )
  select
    prediction_id,
    user_id,
    match_id,
    points,
    exact_hit,
    partial_hit,
    calculated_at
  from public.prediction_scores
  where target_match_id is null or match_id = target_match_id
  on conflict (prediction_id) do update set
    user_id = excluded.user_id,
    match_id = excluded.match_id,
    points = excluded.points,
    exact_hit = excluded.exact_hit,
    partial_hit = excluded.partial_hit,
    calculated_at = excluded.calculated_at,
    updated_at = now();

  insert into public.leaderboards (
    user_id,
    name,
    points,
    played,
    exact_hits,
    partial_hits,
    updated_at
  )
  select
    p.user_id,
    coalesce(pr.display_name, pr.username, split_part(u.email, '@', 1), 'Usuario') as name,
    sum(p.points)::int,
    count(*)::int,
    count(*) filter (where p.exact_hit)::int,
    count(*) filter (where p.partial_hit)::int,
    now()
  from public.points p
  left join public.profiles pr on pr.id = p.user_id
  left join auth.users u on u.id = p.user_id
  group by p.user_id, pr.display_name, pr.username, u.email
  on conflict (user_id) do update set
    name = excluded.name,
    points = excluded.points,
    played = excluded.played,
    exact_hits = excluded.exact_hits,
    partial_hits = excluded.partial_hits,
    updated_at = now();
end;
$$;
