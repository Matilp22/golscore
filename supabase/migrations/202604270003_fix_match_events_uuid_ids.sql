do $$
declare
  match_events_count bigint := 0;
  match_id_type text;
  team_id_type text;
begin
  if to_regclass('public.match_events') is not null then
    select count(*) into match_events_count from public.match_events;

    select data_type
    into match_id_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'match_events'
      and column_name = 'match_id';

    select data_type
    into team_id_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'match_events'
      and column_name = 'team_id';

    if match_events_count = 0 and (match_id_type <> 'uuid' or team_id_type <> 'uuid') then
      drop table public.match_events;
    elsif match_id_type <> 'uuid' or team_id_type <> 'uuid' then
      raise exception 'public.match_events tiene filas y tipos incompatibles: match_id %, team_id %. Migra esos datos manualmente antes de cambiar tipos.', match_id_type, team_id_type;
    end if;
  end if;
end $$;

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  external_event_id text,
  team_id uuid references public.teams(id) on delete set null,
  player_name text not null,
  assist_name text,
  minute integer not null,
  extra_minute integer,
  type text not null,
  detail text,
  created_at timestamptz not null default now(),
  unique (match_id, external_event_id)
);

create index if not exists idx_match_events_match_id_type
on public.match_events (match_id, type);

create index if not exists idx_match_events_created_at
on public.match_events (created_at desc);
