create table if not exists public.user_favorite_leagues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id text not null,
  created_at timestamptz not null default now()
);

delete from public.user_favorite_leagues a
using public.user_favorite_leagues b
where a.user_id = b.user_id
  and a.league_id = b.league_id
  and (
    a.created_at > b.created_at
    or (a.created_at = b.created_at and a.ctid > b.ctid)
  );

create unique index if not exists user_favorite_leagues_user_id_league_id_key
on public.user_favorite_leagues(user_id, league_id);

create index if not exists idx_user_favorite_leagues_user_id
on public.user_favorite_leagues(user_id);

alter table public.user_favorite_leagues enable row level security;

drop policy if exists "user_favorite_leagues_select_own" on public.user_favorite_leagues;
create policy "user_favorite_leagues_select_own"
on public.user_favorite_leagues for select
using (auth.uid() = user_id);

drop policy if exists "user_favorite_leagues_insert_own" on public.user_favorite_leagues;
create policy "user_favorite_leagues_insert_own"
on public.user_favorite_leagues for insert
with check (auth.uid() = user_id);

drop policy if exists "user_favorite_leagues_delete_own" on public.user_favorite_leagues;
create policy "user_favorite_leagues_delete_own"
on public.user_favorite_leagues for delete
using (auth.uid() = user_id);
