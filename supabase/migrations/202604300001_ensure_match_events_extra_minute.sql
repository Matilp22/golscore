alter table public.match_events
add column if not exists extra_minute integer;
