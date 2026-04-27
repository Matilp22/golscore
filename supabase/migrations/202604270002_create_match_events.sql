create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id bigint not null references public.matches(id) on delete cascade,
  external_event_id text,
  team_id bigint references public.teams(id) on delete set null,
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
