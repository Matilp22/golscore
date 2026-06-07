create table if not exists public.match_head_to_head_cache (
  id uuid primary key default gen_random_uuid(),
  team_a_external_id text not null,
  team_b_external_id text not null,
  cache_key text not null unique,
  payload jsonb not null,
  normalized_payload jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_head_to_head_cache_team_a_idx
  on public.match_head_to_head_cache(team_a_external_id);

create index if not exists match_head_to_head_cache_team_b_idx
  on public.match_head_to_head_cache(team_b_external_id);

create index if not exists match_head_to_head_cache_last_synced_at_idx
  on public.match_head_to_head_cache(last_synced_at desc);

alter table public.match_head_to_head_cache enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'touch_updated_at'
  ) and not exists (
    select 1
    from pg_trigger
    where tgname = 'set_match_head_to_head_cache_updated_at'
  ) then
    create trigger set_match_head_to_head_cache_updated_at
      before update on public.match_head_to_head_cache
      for each row
      execute function public.touch_updated_at();
  end if;
end $$;
