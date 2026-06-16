alter table public.teams
  add column if not exists country text,
  add column if not exists code text,
  add column if not exists founded integer,
  add column if not exists national boolean,
  add column if not exists venue_name text,
  add column if not exists venue_address text,
  add column if not exists venue_city text,
  add column if not exists venue_capacity integer,
  add column if not exists venue_surface text,
  add column if not exists venue_image text,
  add column if not exists profile_last_synced_at timestamptz;

create index if not exists teams_country_idx
  on public.teams(country)
  where country is not null;

create index if not exists teams_national_idx
  on public.teams(national)
  where national is true;

comment on column public.teams.country is
  'Team country as reported by provider, used for public team profile display.';
comment on column public.teams.code is
  'Provider team code, for example national team short codes.';
comment on column public.teams.founded is
  'Team founding year as reported by provider.';
comment on column public.teams.national is
  'Whether the provider marks this team as a national team.';
comment on column public.teams.venue_name is
  'Primary stadium or venue name for team profile pages.';
comment on column public.teams.venue_address is
  'Primary stadium address for team profile pages.';
comment on column public.teams.venue_city is
  'Primary stadium city for team profile pages.';
comment on column public.teams.venue_capacity is
  'Primary stadium capacity for team profile pages.';
comment on column public.teams.venue_surface is
  'Primary stadium surface for team profile pages.';
comment on column public.teams.venue_image is
  'Primary stadium image URL for team profile pages.';
comment on column public.teams.profile_last_synced_at is
  'Last time team profile and venue fields were synced from the provider.';
