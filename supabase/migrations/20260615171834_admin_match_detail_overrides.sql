create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_match_detail_overrides (
  id uuid primary key default gen_random_uuid(),
  fixture_external_id text not null,
  overrides jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_match_detail_overrides_overrides_object_check
    check (jsonb_typeof(overrides) = 'object')
);

create unique index if not exists admin_match_detail_overrides_fixture_external_id_key
on public.admin_match_detail_overrides (fixture_external_id);

create index if not exists idx_admin_match_detail_overrides_active
on public.admin_match_detail_overrides (active, fixture_external_id);

drop trigger if exists admin_match_detail_overrides_touch_updated_at
on public.admin_match_detail_overrides;

create trigger admin_match_detail_overrides_touch_updated_at
before update on public.admin_match_detail_overrides
for each row execute function public.touch_updated_at();

alter table public.admin_match_detail_overrides enable row level security;

revoke all on table public.admin_match_detail_overrides from anon, authenticated;

grant select, insert, update, delete on table public.admin_match_detail_overrides to service_role;

comment on table public.admin_match_detail_overrides is
  'Private admin source of truth for match detail overrides that must survive fixture cache syncs.';

comment on column public.admin_match_detail_overrides.overrides is
  'JSON object with manually edited match detail fields, including team kit colors.';
