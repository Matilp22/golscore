alter table public.broadcast_rules
add column if not exists match_external_id text;

alter table public.broadcast_rules
add column if not exists match_date date;

create index if not exists idx_broadcast_rules_match_external_id
on public.broadcast_rules (match_external_id)
where match_external_id is not null;

create index if not exists idx_broadcast_rules_match_date
on public.broadcast_rules (match_date)
where match_date is not null;

comment on column public.broadcast_rules.match_external_id is
  'Optional exact fixture external_id. Exact fixture rules are preferred over team, league and country rules.';

comment on column public.broadcast_rules.match_date is
  'Optional date guard for pair/team rules. Use it to avoid applying a matchup rule to a future rematch.';

/*
Editable exact examples based on the referenced Liga Profesional screen.
These are pair-specific rules, so Home can show a real channel instead of a generic league package.
Adjust channel names if your source changes.
*/
insert into public.broadcast_rules (
  league_external_id,
  league_name,
  country,
  home_team_name,
  away_team_name,
  broadcaster_name,
  broadcaster_logo_url,
  priority,
  active
) values
  ('128', 'Liga Profesional Argentina', 'Argentina', 'Barracas Central', 'Banfield', 'TNT Sports', null, 10, true),
  ('128', 'Liga Profesional Argentina', 'Argentina', 'Lanus', 'Deportivo Riestra', 'ESPN Premium', null, 10, true),
  ('128', 'Liga Profesional Argentina', 'Argentina', 'Central Cordoba', 'Boca Juniors', 'TNT Sports', null, 10, true),
  ('128', 'Liga Profesional Argentina', 'Argentina', 'San Lorenzo', 'Independiente', 'TNT Sports', null, 10, true),
  ('128', 'Liga Profesional Argentina', 'Argentina', 'Union Santa Fe', 'Talleres Cordoba', 'ESPN Premium', null, 10, true),
  ('128', 'Liga Profesional Argentina', 'Argentina', 'Platense', 'Estudiantes', 'ESPN Premium', null, 10, true)
on conflict do nothing;
