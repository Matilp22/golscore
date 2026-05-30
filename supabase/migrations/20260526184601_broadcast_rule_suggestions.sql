create table if not exists public.broadcast_rule_suggestions (
  id uuid primary key default gen_random_uuid(),
  league_external_id text,
  league_name text,
  broadcaster_name text not null,
  broadcaster_logo_url text,
  evidence_count integer not null default 0,
  sample_match_ids uuid[] not null default '{}',
  confidence text not null default 'medium',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.broadcast_rule_suggestions
  enable row level security;

alter table public.broadcast_rule_suggestions
  add constraint broadcast_rule_suggestions_league_broadcaster_key
  unique (league_external_id, broadcaster_name);

create index if not exists idx_broadcast_rule_suggestions_status
on public.broadcast_rule_suggestions (status);

comment on table public.broadcast_rule_suggestions is
  'Pending TV rule suggestions inferred from repeated verified provider broadcasts. Suggestions never apply automatically.';

comment on column public.broadcast_rule_suggestions.evidence_count is
  'Number of matches where the provider returned this broadcaster for this league.';

comment on column public.broadcast_rule_suggestions.status is
  'pending, approved or rejected. Only approved suggestions can create verified broadcast_rules.';
