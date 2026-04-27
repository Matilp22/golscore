alter table public.matches
add column if not exists broadcast_channel text;

comment on column public.matches.broadcast_channel is
  'Optional TV channel or streaming platform shown on Home, for example ESPN Premium, TyC Sports, Disney+ or TNT Sports.';
