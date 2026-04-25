alter table public.matches
add column if not exists home_penalty_score int;

alter table public.matches
add column if not exists away_penalty_score int;
