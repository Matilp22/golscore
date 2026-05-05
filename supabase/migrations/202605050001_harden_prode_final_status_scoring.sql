do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.prediction_scores'::regclass
      and conname = 'prediction_scores_prediction_id_key'
  ) then
    alter table public.prediction_scores
      add constraint prediction_scores_prediction_id_key unique (prediction_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leaderboards'::regclass
      and conname = 'leaderboards_user_id_key'
  ) then
    alter table public.leaderboards
      alter column user_id set not null;

    alter table public.leaderboards
      add constraint leaderboards_user_id_key unique (user_id);
  end if;
end $$;

alter table public.prediction_scores
  add column if not exists calculated_at timestamptz not null default now();

drop function if exists public.recalculate_prediction_scores(bigint);
drop function if exists public.recalculate_prediction_scores(text);

create or replace function public.recalculate_prediction_scores(target_match_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.prediction_scores ps
  using public.predictions p
  join public.matches m on m.id = p.match_id
  where ps.prediction_id = p.id
    and (target_match_id is null or p.match_id = target_match_id)
    and not (
      m.home_score is not null
      and m.away_score is not null
      and lower(trim(coalesce(m.status, ''))) in ('ft', 'aet', 'pen', 'finished', 'match finished')
    );

  insert into public.prediction_scores (
    prediction_id,
    user_id,
    match_id,
    points,
    exact_hit,
    partial_hit,
    is_exact,
    is_partial,
    calculated_at,
    updated_at
  )
  select
    p.id,
    p.user_id,
    p.match_id,
    case
      when p.predicted_home_score = m.home_score
        and p.predicted_away_score = m.away_score then 3
      when sign(p.predicted_home_score - p.predicted_away_score) =
        sign(m.home_score - m.away_score) then 1
      else 0
    end as points,
    (
      p.predicted_home_score = m.home_score
      and p.predicted_away_score = m.away_score
    ) as exact_hit,
    (
      sign(p.predicted_home_score - p.predicted_away_score) =
        sign(m.home_score - m.away_score)
      and not (
        p.predicted_home_score = m.home_score
        and p.predicted_away_score = m.away_score
      )
    ) as partial_hit,
    (
      p.predicted_home_score = m.home_score
      and p.predicted_away_score = m.away_score
    ) as is_exact,
    (
      sign(p.predicted_home_score - p.predicted_away_score) =
        sign(m.home_score - m.away_score)
      and not (
        p.predicted_home_score = m.home_score
        and p.predicted_away_score = m.away_score
      )
    ) as is_partial,
    now(),
    now()
  from public.predictions p
  join public.matches m on m.id = p.match_id
  where (target_match_id is null or p.match_id = target_match_id)
    and m.home_score is not null
    and m.away_score is not null
    and lower(trim(coalesce(m.status, ''))) in ('ft', 'aet', 'pen', 'finished', 'match finished')
  on conflict (prediction_id) do update set
    user_id = excluded.user_id,
    match_id = excluded.match_id,
    points = excluded.points,
    exact_hit = excluded.exact_hit,
    partial_hit = excluded.partial_hit,
    is_exact = excluded.is_exact,
    is_partial = excluded.is_partial,
    updated_at = excluded.updated_at;

  if target_match_id is null then
    delete from public.leaderboards;
  else
    delete from public.leaderboards lb
    where exists (
      select 1
      from public.predictions p
      where p.match_id = target_match_id
        and p.user_id = lb.user_id
    );
  end if;

  insert into public.leaderboards (
    user_id,
    total_points,
    exact_predictions,
    partial_predictions,
    updated_at
  )
  select
    ps.user_id,
    coalesce(sum(ps.points), 0)::int,
    count(*) filter (where ps.exact_hit)::int,
    count(*) filter (where ps.partial_hit)::int,
    now()
  from public.prediction_scores ps
  where target_match_id is null
    or exists (
      select 1
      from public.predictions p
      where p.match_id = target_match_id
        and p.user_id = ps.user_id
    )
  group by ps.user_id
  on conflict (user_id) do update set
    total_points = excluded.total_points,
    exact_predictions = excluded.exact_predictions,
    partial_predictions = excluded.partial_predictions,
    updated_at = excluded.updated_at;
end;
$$;
