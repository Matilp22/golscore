alter table public.matches
  add column if not exists venue_id text,
  add column if not exists venue_name text,
  add column if not exists venue_city text,
  add column if not exists venue_country text,
  add column if not exists referee text,
  add column if not exists timezone text,
  add column if not exists elapsed integer,
  add column if not exists final_elapsed integer;

comment on column public.matches.venue_id is
  'Optional API-Football venue id used by match detail audits and future fixture enrichment.';

comment on column public.matches.venue_name is
  'Optional stadium/venue name shown in match detail before, during and after the match.';

comment on column public.matches.venue_city is
  'Optional venue city shown in match detail when available from the provider.';

comment on column public.matches.referee is
  'Optional referee name shown in match detail when available from the provider.';

comment on column public.matches.timezone is
  'Optional provider timezone for fixture date normalization and audits.';
