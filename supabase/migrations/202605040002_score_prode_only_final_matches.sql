create or replace function public.recalculate_prediction_scores(target_match_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.points po
  using public.predictions p
  join public.matches m on m.id = p.match_id
  where po.prediction_id = p.id
    and (target_match_id is null or p.match_id = target_match_id)
    and (
      m.home_score is null
      or m.away_score is null
      or lower(coalesce(m.status, '')) not in (
        'ft',
        'aet',
        'pen',
        'final',
        'finished',
        'match finished',
        'cerrado'
      )
    );

  delete from public.prediction_scores ps
  using public.predictions p
  join public.matches m on m.id = p.match_id
  where ps.prediction_id = p.id
    and (target_match_id is null or p.match_id = target_match_id)
    and (
      m.home_score is null
      or m.away_score is null
      or lower(coalesce(m.status, '')) not in (
        'ft',
        'aet',
        'pen',
        'final',
        'finished',
        'match finished',
        'cerrado'
      )
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
  where m.home_score is not null
    and m.away_score is not null
    and lower(coalesce(m.status, '')) in (
      'ft',
      'aet',
      'pen',
      'final',
      'finished',
      'match finished',
      'cerrado'
    )
    and (target_match_id is null or p.match_id = target_match_id)
  on conflict (prediction_id) do update set
    user_id = excluded.user_id,
    match_id = excluded.match_id,
    points = excluded.points,
    exact_hit = excluded.exact_hit,
    partial_hit = excluded.partial_hit,
    is_exact = excluded.is_exact,
    is_partial = excluded.is_partial,
    calculated_at = excluded.calculated_at,
    updated_at = excluded.updated_at;

  insert into public.points (
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
  from public.prediction_scores
  where target_match_id is null or match_id = target_match_id
  on conflict (prediction_id) do update set
    user_id = excluded.user_id,
    match_id = excluded.match_id,
    points = excluded.points,
    exact_hit = excluded.exact_hit,
    partial_hit = excluded.partial_hit,
    is_exact = excluded.is_exact,
    is_partial = excluded.is_partial,
    calculated_at = excluded.calculated_at,
    updated_at = excluded.updated_at;

  delete from public.leaderboards lb
  where target_match_id is null
    or exists (
      select 1
      from public.predictions p
      where p.match_id = target_match_id
        and p.user_id = lb.user_id
    );

  insert into public.leaderboards (
    user_id,
    total_points,
    played,
    exact_predictions,
    partial_predictions,
    updated_at
  )
  select
    ps.user_id,
    sum(ps.points)::int,
    count(*)::int,
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
    played = excluded.played,
    exact_predictions = excluded.exact_predictions,
    partial_predictions = excluded.partial_predictions,
    updated_at = now();
end;
$$;
