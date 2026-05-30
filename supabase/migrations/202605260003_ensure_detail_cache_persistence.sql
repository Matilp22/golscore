alter table public.football_match_detail_cache
  add column if not exists fixture_payload jsonb,
  add column if not exists events jsonb not null default '[]'::jsonb,
  add column if not exists lineups jsonb not null default '[]'::jsonb,
  add column if not exists statistics jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'football_match_detail_cache_fixture_unique'
      and conrelid = 'public.football_match_detail_cache'::regclass
  ) then
    alter table public.football_match_detail_cache
      add constraint football_match_detail_cache_fixture_unique unique (fixture_external_id);
  end if;
end $$;

grant select, insert, update, delete on table public.football_match_detail_cache to service_role;
