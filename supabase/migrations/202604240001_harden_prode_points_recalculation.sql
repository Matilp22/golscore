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
    end as points,
    (
      p.predicted_home_score = coalesce(r.home_score, m.home_score)
      and p.predicted_away_score = coalesce(r.away_score, m.away_score)
    ) as exact_hit,
    (
      sign(p.predicted_home_score - p.predicted_away_score) =
        sign(coalesce(r.home_score, m.home_score) - coalesce(r.away_score, m.away_score))
      and not (
        p.predicted_home_score = coalesce(r.home_score, m.home_score)
        and p.predicted_away_score = coalesce(r.away_score, m.away_score)
      )
    ) as partial_hit,
    now()
  from public.predictions p
  join public.matches m on m.id = p.match_id
  left join public.results r on r.match_id = m.id
  where lower(coalesce(r.status, m.status, '')) in (
      'final',
      'ft',
      'aet',
      'pen',
      'finished',
      'match finished'
    )
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
