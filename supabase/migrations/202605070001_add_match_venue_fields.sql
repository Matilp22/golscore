alter table public.matches
  add column if not exists venue_name text,
  add column if not exists venue_city text,
  add column if not exists venue_country text;
