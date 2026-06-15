alter table public.players
  add column if not exists height text,
  add column if not exists club_external_id text,
  add column if not exists club_name text,
  add column if not exists club_logo_url text,
  add column if not exists profile_last_synced_at timestamptz;

create index if not exists players_club_external_id_idx
  on public.players(club_external_id)
  where club_external_id is not null;

comment on column public.players.height is
  'Player height as reported by provider, normalized for roster display.';
comment on column public.players.club_external_id is
  'Current club provider id for players shown in national team squads.';
comment on column public.players.club_name is
  'Current club display name for players shown in national team squads.';
comment on column public.players.club_logo_url is
  'Current club crest URL for players shown in national team squads.';
comment on column public.players.profile_last_synced_at is
  'Last time non-photo player profile fields were synced from the provider.';
