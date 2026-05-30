alter table public.match_broadcasts
  add column if not exists source text,
  add column if not exists confidence text,
  add column if not exists verified boolean not null default false,
  add column if not exists created_by_rule_id uuid references public.broadcast_rules(id) on delete set null;

alter table public.broadcast_rules
  add column if not exists source text,
  add column if not exists confidence text,
  add column if not exists verified boolean not null default false;

create index if not exists idx_match_broadcasts_verified
on public.match_broadcasts (verified);

create index if not exists idx_match_broadcasts_created_by_rule_id
on public.match_broadcasts (created_by_rule_id)
where created_by_rule_id is not null;

create index if not exists idx_broadcast_rules_verified
on public.broadcast_rules (verified);

comment on column public.match_broadcasts.source is
  'Origin of the broadcaster value. Trusted UI render accepts manual, verified_rule or official sources.';

comment on column public.match_broadcasts.confidence is
  'Confidence label for broadcaster value: high, medium or low.';

comment on column public.match_broadcasts.verified is
  'Only verified/high-confidence broadcasters should be shown in the UI.';

comment on column public.match_broadcasts.created_by_rule_id is
  'Broadcast rule that created this row, when it came from a verified rule sync.';

comment on column public.broadcast_rules.source is
  'Origin of the rule: manual, verified_rule, official or generated/fallback.';

comment on column public.broadcast_rules.confidence is
  'Confidence label for rule: high, medium or low.';

comment on column public.broadcast_rules.verified is
  'Rules must be verified/high-confidence before they can create visible TV rows.';

update public.broadcast_rules
set
  source = coalesce(source, 'generated_default'),
  confidence = coalesce(confidence, 'low'),
  verified = false
where
  broadcaster_name ilike '%espn%'
  and coalesce(verified, false) = false;

update public.match_broadcasts
set
  source = coalesce(source, 'generated_default'),
  confidence = coalesce(confidence, 'low'),
  verified = false
where
  broadcaster_name ilike '%espn%'
  and coalesce(verified, false) = false;
