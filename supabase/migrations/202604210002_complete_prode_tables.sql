create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  match_id bigint not null unique references public.matches(id) on delete cascade,
  home_score int not null,
  away_score int not null,
  status text not null default 'final',
  source text not null default 'api-football',
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint results_scores_non_negative check (
    home_score >= 0 and away_score >= 0
  )
);

create table if not exists public.points (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null unique references public.predictions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id bigint not null references public.matches(id) on delete cascade,
  points int not null default 0,
  exact_hit boolean not null default false,
  partial_hit boolean not null default false,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint points_valid_value check (points in (0, 1, 3))
);

create table if not exists public.leaderboards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  points int not null default 0,
  played int not null default 0,
  exact_hits int not null default 0,
  partial_hits int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_results_match_id on public.results(match_id);
create index if not exists idx_points_user_id on public.points(user_id);
create index if not exists idx_points_match_id on public.points(match_id);
create index if not exists idx_leaderboards_points on public.leaderboards(points desc, exact_hits desc);

drop trigger if exists results_touch_updated_at on public.results;
create trigger results_touch_updated_at
before update on public.results
for each row execute function public.touch_updated_at();

drop trigger if exists points_touch_updated_at on public.points;
create trigger points_touch_updated_at
before update on public.points
for each row execute function public.touch_updated_at();

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

create or replace view public.leaderboard as
select
  user_id,
  name,
  points,
  played,
  exact_hits,
  partial_hits,
  updated_at
from public.leaderboards;

alter table public.results enable row level security;
alter table public.points enable row level security;
alter table public.leaderboards enable row level security;

drop policy if exists "public_read_results" on public.results;
create policy "public_read_results"
on public.results for select
using (true);

drop policy if exists "points_select_public" on public.points;
create policy "points_select_public"
on public.points for select
using (true);

drop policy if exists "leaderboards_select_public" on public.leaderboards;
create policy "leaderboards_select_public"
on public.leaderboards for select
using (true);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();
