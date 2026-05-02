alter table public.matches
add column if not exists broadcast_logo_url text;

comment on column public.matches.broadcast_logo_url is
  'Optional broadcaster logo shown next to broadcast_channel in match rows.';
