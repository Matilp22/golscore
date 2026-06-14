create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_featured_matches (
  id uuid primary key default gen_random_uuid(),
  fixture_external_id text not null,
  title text,
  home_team text,
  away_team text,
  league_name text,
  match_date timestamptz,
  featured boolean not null default true,
  priority integer not null default 100,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_featured_matches_fixture_external_id_key
on public.admin_featured_matches (fixture_external_id);

create index if not exists idx_admin_featured_matches_featured_priority
on public.admin_featured_matches (featured, priority, match_date);

drop trigger if exists admin_featured_matches_touch_updated_at
on public.admin_featured_matches;

create trigger admin_featured_matches_touch_updated_at
before update on public.admin_featured_matches
for each row execute function public.touch_updated_at();

create table if not exists public.admin_broadcast_overrides (
  id uuid primary key default gen_random_uuid(),
  fixture_external_id text not null,
  broadcaster_name text not null,
  broadcaster_logo_url text,
  country text,
  active boolean not null default true,
  priority integer not null default 100,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_broadcast_overrides_fixture_external_id
on public.admin_broadcast_overrides (fixture_external_id);

create index if not exists idx_admin_broadcast_overrides_active_priority
on public.admin_broadcast_overrides (active, priority);

drop trigger if exists admin_broadcast_overrides_touch_updated_at
on public.admin_broadcast_overrides;

create trigger admin_broadcast_overrides_touch_updated_at
before update on public.admin_broadcast_overrides
for each row execute function public.touch_updated_at();

create table if not exists public.admin_ad_slots (
  id uuid primary key default gen_random_uuid(),
  slot_key text not null unique,
  label text not null,
  location text not null,
  provider text not null default 'adsense',
  enabled boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_ad_slots_enabled
on public.admin_ad_slots (enabled, slot_key);

drop trigger if exists admin_ad_slots_touch_updated_at
on public.admin_ad_slots;

create trigger admin_ad_slots_touch_updated_at
before update on public.admin_ad_slots
for each row execute function public.touch_updated_at();

insert into public.admin_ad_slots (slot_key, label, location, provider, enabled)
values
  ('home_top', 'Home superior', 'home_top', 'adsense', false),
  ('home_between_leagues', 'Home entre ligas', 'home_between_leagues', 'adsense', false),
  ('match_detail_after_summary', 'Detalle despues del resumen', 'match_detail_after_summary', 'adsense', false),
  ('match_detail_after_stats', 'Detalle despues de estadisticas', 'match_detail_after_stats', 'adsense', false),
  ('league_page_between_sections', 'Liga entre secciones', 'league_page_between_sections', 'adsense', false)
on conflict (slot_key) do nothing;

create table if not exists public.admin_visibility_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type text not null,
  value text not null,
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_visibility_rules_type_check
    check (rule_type in ('league', 'team', 'fixture', 'country', 'keyword'))
);

create index if not exists idx_admin_visibility_rules_active_type
on public.admin_visibility_rules (active, rule_type);

create index if not exists idx_admin_visibility_rules_value
on public.admin_visibility_rules (value);

drop trigger if exists admin_visibility_rules_touch_updated_at
on public.admin_visibility_rules;

create trigger admin_visibility_rules_touch_updated_at
before update on public.admin_visibility_rules
for each row execute function public.touch_updated_at();

alter table public.admin_featured_matches enable row level security;
alter table public.admin_broadcast_overrides enable row level security;
alter table public.admin_ad_slots enable row level security;
alter table public.admin_visibility_rules enable row level security;

revoke all on table public.admin_featured_matches from anon, authenticated;
revoke all on table public.admin_broadcast_overrides from anon, authenticated;
revoke all on table public.admin_ad_slots from anon, authenticated;
revoke all on table public.admin_visibility_rules from anon, authenticated;

grant select, insert, update, delete on table public.admin_featured_matches to service_role;
grant select, insert, update, delete on table public.admin_broadcast_overrides to service_role;
grant select, insert, update, delete on table public.admin_ad_slots to service_role;
grant select, insert, update, delete on table public.admin_visibility_rules to service_role;

comment on table public.admin_featured_matches is
  'Private admin overrides for manually featured matches.';

comment on table public.admin_broadcast_overrides is
  'Private admin TV/broadcast overrides by API-Football fixture id.';

comment on table public.admin_ad_slots is
  'Private admin configuration for future ad and sponsor slots.';

comment on table public.admin_visibility_rules is
  'Private admin visibility rules prepared for future public filtering.';
