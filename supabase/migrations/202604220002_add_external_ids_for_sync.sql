alter table public.leagues
add column if not exists external_id bigint;

alter table public.leagues
add column if not exists season int;

alter table public.teams
add column if not exists external_id bigint;

alter table public.matches
add column if not exists external_id bigint;

alter table public.matches
add column if not exists match_date timestamptz;

alter table public.matches
add column if not exists round text;

alter table public.matches
add column if not exists status text;

alter table public.matches
add column if not exists home_score int;

alter table public.matches
add column if not exists away_score int;

update public.matches
set match_date = coalesce(match_date, now())
where match_date is null;

create unique index if not exists leagues_external_id_key
on public.leagues (external_id);

create unique index if not exists teams_external_id_key
on public.teams (external_id);

create unique index if not exists matches_external_id_key
on public.matches (external_id);

create index if not exists idx_matches_external_id
on public.matches (external_id);

create index if not exists idx_matches_league_match_date
on public.matches (league_id, match_date);
