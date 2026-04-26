alter table public.leaderboards
  add column if not exists total_points int not null default 0,
  add column if not exists exact_predictions int not null default 0,
  add column if not exists partial_predictions int not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table public.points
  add column if not exists prediction_id uuid references public.predictions(id) on delete cascade,
  add column if not exists exact_hit boolean not null default false,
  add column if not exists partial_hit boolean not null default false,
  add column if not exists calculated_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists points_prediction_id_key
  on public.points(prediction_id)
  where prediction_id is not null;

alter table public.prediction_scores
  add column if not exists calculated_at timestamptz not null default now();

create or replace function public.recalculate_prediction_scores(target_match_id bigint default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.points po
  using public.predictions p
  join public.matches m on m.id = p.match_id
  left join public.results r on r.match_id = m.id
  where po.prediction_id = p.id
    and (target_match_id is null or p.match_id = target_match_id)
    and (
      coalesce(r.home_score, m.home_score) is null
      or coalesce(r.away_score, m.away_score) is null
    );

  delete from public.prediction_scores ps
  using public.predictions p
  join public.matches m on m.id = p.match_id
  left join public.results r on r.match_id = m.id
  where ps.prediction_id = p.id
    and (target_match_id is null or p.match_id = target_match_id)
    and (
      coalesce(r.home_score, m.home_score) is null
      or coalesce(r.away_score, m.away_score) is null
    );

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
  where coalesce(r.home_score, m.home_score) is not null
    and coalesce(r.away_score, m.away_score) is not null
    and (target_match_id is null or p.match_id = target_match_id)
  on conflict (prediction_id) do update set
    user_id = excluded.user_id,
    match_id = excluded.match_id,
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
    exact_predictions,
    partial_predictions,
    updated_at
  )
  select
    ps.user_id,
    sum(ps.points)::int,
    count(*) filter (where ps.exact_hit)::int,
    count(*) filter (where ps.partial_hit)::int,
    now()
  from public.prediction_scores ps
  left join public.profiles pr on pr.id = ps.user_id
  where target_match_id is null
    or exists (
      select 1
      from public.predictions p
      where p.match_id = target_match_id
        and p.user_id = ps.user_id
    )
  group by ps.user_id, pr.username, pr.display_name
  on conflict (user_id) do update set
    total_points = excluded.total_points,
    exact_predictions = excluded.exact_predictions,
    partial_predictions = excluded.partial_predictions,
    updated_at = now();
end;
$$;
