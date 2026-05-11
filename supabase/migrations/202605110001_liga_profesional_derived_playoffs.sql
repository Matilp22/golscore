alter table public.matches
  alter column match_date drop not null;

alter table public.matches
  add column if not exists source text not null default 'api',
  add column if not exists is_derived boolean not null default false,
  add column if not exists derived_from_round text,
  add column if not exists bracket_phase text,
  add column if not exists bracket_slot integer,
  add column if not exists source_match_a_id uuid references public.matches(id) on delete set null,
  add column if not exists source_match_b_id uuid references public.matches(id) on delete set null;

create unique index if not exists matches_derived_bracket_slot_key
on public.matches (league_id, round, bracket_slot)
where is_derived = true and bracket_slot is not null;

create index if not exists idx_matches_league_bracket_phase
on public.matches (league_id, bracket_phase, bracket_slot);
