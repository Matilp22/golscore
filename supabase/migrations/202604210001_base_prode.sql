create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.competitions (
  id bigserial primary key,
  external_id bigint unique,
  name text not null,
  country text,
  logo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id bigserial primary key,
  competition_id bigint references public.competitions(id) on delete set null,
  external_id bigint unique,
  name text not null,
  country text,
  season int not null,
  logo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id bigserial primary key,
  external_id bigint unique,
  name text not null,
  logo_url text,
  country text,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id bigint primary key,
  league_id bigint references public.leagues(id) on delete set null,
  round text,
  match_date timestamptz not null,
  home_team_id bigint references public.teams(id) on delete set null,
  away_team_id bigint references public.teams(id) on delete set null,
  home_score int,
  away_score int,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_scores_non_negative check (
    (home_score is null or home_score >= 0) and
    (away_score is null or away_score >= 0)
  )
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id bigint not null references public.matches(id) on delete cascade,
  predicted_home_score int not null,
  predicted_away_score int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id),
  constraint predictions_scores_non_negative check (
    predicted_home_score >= 0 and predicted_away_score >= 0
  )
);

create table if not exists public.prediction_scores (
  prediction_id uuid primary key references public.predictions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id bigint not null references public.matches(id) on delete cascade,
  points int not null default 0,
  exact_hit boolean not null default false,
  partial_hit boolean not null default false,
  calculated_at timestamptz not null default now()
);

create index if not exists idx_matches_match_date on public.matches(match_date);
create index if not exists idx_matches_league_round on public.matches(league_id, round);
create index if not exists idx_predictions_user_id on public.predictions(user_id);
create index if not exists idx_predictions_match_id on public.predictions(match_id);
create index if not exists idx_prediction_scores_user_id on public.prediction_scores(user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists matches_touch_updated_at on public.matches;
create trigger matches_touch_updated_at
before update on public.matches
for each row execute function public.touch_updated_at();

drop trigger if exists predictions_touch_updated_at on public.predictions;
create trigger predictions_touch_updated_at
before update on public.predictions
for each row execute function public.touch_updated_at();

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

drop trigger if exists predictions_prevent_locked_insert on public.predictions;
create trigger predictions_prevent_locked_insert
before insert or update on public.predictions
for each row execute function public.prevent_locked_prediction();

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
      when p.predicted_home_score = m.home_score and p.predicted_away_score = m.away_score then 3
      when sign(p.predicted_home_score - p.predicted_away_score) = sign(m.home_score - m.away_score) then 1
      else 0
    end as points,
    (p.predicted_home_score = m.home_score and p.predicted_away_score = m.away_score) as exact_hit,
    (
      sign(p.predicted_home_score - p.predicted_away_score) = sign(m.home_score - m.away_score)
      and not (p.predicted_home_score = m.home_score and p.predicted_away_score = m.away_score)
    ) as partial_hit,
    now()
  from public.predictions p
  join public.matches m on m.id = p.match_id
  where m.status in ('final', 'FT', 'AET', 'PEN')
    and m.home_score is not null
    and m.away_score is not null
    and (target_match_id is null or p.match_id = target_match_id)
  on conflict (prediction_id) do update set
    points = excluded.points,
    exact_hit = excluded.exact_hit,
    partial_hit = excluded.partial_hit,
    calculated_at = excluded.calculated_at;
end;
$$;

create or replace view public.leaderboard as
select
  ps.user_id,
  coalesce(pr.display_name, pr.username, split_part(u.email, '@', 1)) as name,
  sum(ps.points)::int as points,
  count(*)::int as played,
  count(*) filter (where ps.exact_hit)::int as exact_hits,
  count(*) filter (where ps.partial_hit)::int as partial_hits
from public.prediction_scores ps
left join public.profiles pr on pr.id = ps.user_id
left join auth.users u on u.id = ps.user_id
group by ps.user_id, pr.display_name, pr.username, u.email;

alter table public.profiles enable row level security;
alter table public.competitions enable row level security;
alter table public.leagues enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.prediction_scores enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
on public.profiles for select
using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "public_read_competitions" on public.competitions;
create policy "public_read_competitions"
on public.competitions for select
using (true);

drop policy if exists "public_read_leagues" on public.leagues;
create policy "public_read_leagues"
on public.leagues for select
using (true);

drop policy if exists "public_read_teams" on public.teams;
create policy "public_read_teams"
on public.teams for select
using (true);

drop policy if exists "public_read_matches" on public.matches;
create policy "public_read_matches"
on public.matches for select
using (true);

drop policy if exists "predictions_select_own" on public.predictions;
create policy "predictions_select_own"
on public.predictions for select
using (auth.uid() = user_id);

drop policy if exists "predictions_insert_own" on public.predictions;
create policy "predictions_insert_own"
on public.predictions for insert
with check (auth.uid() = user_id);

drop policy if exists "predictions_update_own" on public.predictions;
create policy "predictions_update_own"
on public.predictions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "prediction_scores_select_own" on public.prediction_scores;
drop policy if exists "prediction_scores_select_public" on public.prediction_scores;
create policy "prediction_scores_select_public"
on public.prediction_scores for select
using (true);
