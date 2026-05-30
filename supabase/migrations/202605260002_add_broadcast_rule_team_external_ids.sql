alter table public.broadcast_rules
  add column if not exists home_team_external_id text,
  add column if not exists away_team_external_id text;

create index if not exists idx_broadcast_rules_home_team_external_id
on public.broadcast_rules (home_team_external_id)
where home_team_external_id is not null;

create index if not exists idx_broadcast_rules_away_team_external_id
on public.broadcast_rules (away_team_external_id)
where away_team_external_id is not null;

comment on column public.broadcast_rules.home_team_external_id is
  'Optional API-Football id for the home team. Used by broadcast rule sync/audit.';

comment on column public.broadcast_rules.away_team_external_id is
  'Optional API-Football id for the away team. Used by broadcast rule sync/audit.';
