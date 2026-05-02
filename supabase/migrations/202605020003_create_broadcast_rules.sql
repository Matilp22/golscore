create table if not exists public.broadcast_rules (
  id uuid primary key default gen_random_uuid(),
  league_external_id text,
  league_name text,
  country text,
  home_team_name text,
  away_team_name text,
  broadcaster_name text not null,
  broadcaster_logo_url text,
  priority integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_broadcast_rules_active_priority
on public.broadcast_rules (active, priority);

create index if not exists idx_broadcast_rules_league_external_id
on public.broadcast_rules (league_external_id)
where league_external_id is not null;

comment on table public.broadcast_rules is
  'Rules used by /api/admin/sync-broadcasts to populate match_broadcasts for current and future matches.';

comment on column public.broadcast_rules.priority is
  'Lower values win. Rules with the same best priority are all applied, which allows multiple broadcasters.';

/*
Editable examples. Run only the rules you want active in your project.

-- Liga Profesional Argentina (API-Football league_external_id 128)
insert into public.broadcast_rules (
  league_external_id,
  league_name,
  country,
  broadcaster_name,
  priority,
  active
) values
  ('128', 'Liga Profesional Argentina', 'Argentina', 'ESPN Premium', 100, true),
  ('128', 'Liga Profesional Argentina', 'Argentina', 'TNT Sports', 100, true)
on conflict do nothing;

-- Primera Nacional: edit broadcaster if your coverage source changes.
insert into public.broadcast_rules (
  league_name,
  country,
  broadcaster_name,
  priority,
  active
) values
  ('Primera Nacional', 'Argentina', 'TyC Sports Play', 100, true)
on conflict do nothing;

-- More specific example: this lower priority overrides generic league rules.
insert into public.broadcast_rules (
  league_external_id,
  home_team_name,
  broadcaster_name,
  priority,
  active
) values
  ('128', 'Boca Juniors', 'ESPN Premium', 10, true)
on conflict do nothing;
*/
