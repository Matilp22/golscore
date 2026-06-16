alter table public.players
  add column if not exists firstname text,
  add column if not exists lastname text,
  add column if not exists age integer,
  add column if not exists nationality text,
  add column if not exists birth_date date,
  add column if not exists birth_place text,
  add column if not exists birth_country text,
  add column if not exists weight text,
  add column if not exists injured boolean;

create index if not exists players_nationality_idx
  on public.players(nationality)
  where nationality is not null;

comment on column public.players.firstname is
  'Player first name as reported by provider.';
comment on column public.players.lastname is
  'Player last name as reported by provider.';
comment on column public.players.age is
  'Player age as reported by provider.';
comment on column public.players.nationality is
  'Player nationality as reported by provider.';
comment on column public.players.birth_date is
  'Player birth date as reported by provider.';
comment on column public.players.birth_place is
  'Player birth place as reported by provider.';
comment on column public.players.birth_country is
  'Player birth country as reported by provider.';
comment on column public.players.weight is
  'Player weight as reported by provider.';
comment on column public.players.injured is
  'Whether the provider reports the player as injured.';
