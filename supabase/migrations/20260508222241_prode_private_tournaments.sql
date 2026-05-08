create or replace function public.normalize_prode_private_tournament_name(input_name text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(input_name, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.set_prode_private_tournament_normalized_name()
returns trigger
language plpgsql
as $$
begin
  new.name = regexp_replace(btrim(new.name), '\s+', ' ', 'g');
  new.normalized_name = public.normalize_prode_private_tournament_name(new.name);

  if new.normalized_name = '' then
    raise exception 'El nombre del torneo no puede estar vacio';
  end if;

  return new;
end;
$$;

create table if not exists public.prode_private_tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prode_private_tournaments_name_not_blank check (
    char_length(public.normalize_prode_private_tournament_name(name)) > 0
  )
);

create table if not exists public.prode_private_tournament_members (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.prode_private_tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  constraint prode_private_tournament_members_role_check check (role in ('owner', 'member')),
  unique (tournament_id, user_id)
);

create table if not exists public.prode_private_tournament_join_requests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.prode_private_tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint prode_private_tournament_join_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  unique (tournament_id, user_id)
);

create index if not exists idx_prode_private_tournaments_created_by
  on public.prode_private_tournaments(created_by);

create index if not exists idx_prode_private_tournament_members_user_id
  on public.prode_private_tournament_members(user_id);

create index if not exists idx_prode_private_tournament_members_tournament_role
  on public.prode_private_tournament_members(tournament_id, role);

create index if not exists idx_prode_private_tournament_join_requests_user_id
  on public.prode_private_tournament_join_requests(user_id);

create index if not exists idx_prode_private_tournament_join_requests_pending
  on public.prode_private_tournament_join_requests(tournament_id, status)
  where status = 'pending';

drop trigger if exists prode_private_tournaments_normalize_name
  on public.prode_private_tournaments;
create trigger prode_private_tournaments_normalize_name
before insert or update of name on public.prode_private_tournaments
for each row execute function public.set_prode_private_tournament_normalized_name();

drop trigger if exists prode_private_tournaments_touch_updated_at
  on public.prode_private_tournaments;
create trigger prode_private_tournaments_touch_updated_at
before update on public.prode_private_tournaments
for each row execute function public.touch_updated_at();

alter table public.prode_private_tournaments enable row level security;
alter table public.prode_private_tournament_members enable row level security;
alter table public.prode_private_tournament_join_requests enable row level security;

drop policy if exists "prode_private_tournaments_select_member"
  on public.prode_private_tournaments;
create policy "prode_private_tournaments_select_member"
on public.prode_private_tournaments for select
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.prode_private_tournament_members m
    where m.tournament_id = prode_private_tournaments.id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "prode_private_tournaments_insert_own"
  on public.prode_private_tournaments;
create policy "prode_private_tournaments_insert_own"
on public.prode_private_tournaments for insert
with check (created_by = auth.uid());

drop policy if exists "prode_private_tournaments_update_owner"
  on public.prode_private_tournaments;
create policy "prode_private_tournaments_update_owner"
on public.prode_private_tournaments for update
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.prode_private_tournament_members m
    where m.tournament_id = prode_private_tournaments.id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1
    from public.prode_private_tournament_members m
    where m.tournament_id = prode_private_tournaments.id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

drop policy if exists "prode_private_tournament_members_select_own_or_creator"
  on public.prode_private_tournament_members;
create policy "prode_private_tournament_members_select_own_or_creator"
on public.prode_private_tournament_members for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.prode_private_tournaments t
    where t.id = prode_private_tournament_members.tournament_id
      and t.created_by = auth.uid()
  )
);

drop policy if exists "prode_private_tournament_members_insert_creator"
  on public.prode_private_tournament_members;
create policy "prode_private_tournament_members_insert_creator"
on public.prode_private_tournament_members for insert
with check (
  exists (
    select 1
    from public.prode_private_tournaments t
    where t.id = prode_private_tournament_members.tournament_id
      and t.created_by = auth.uid()
  )
);

drop policy if exists "prode_private_tournament_members_delete_creator"
  on public.prode_private_tournament_members;
create policy "prode_private_tournament_members_delete_creator"
on public.prode_private_tournament_members for delete
using (
  exists (
    select 1
    from public.prode_private_tournaments t
    where t.id = prode_private_tournament_members.tournament_id
      and t.created_by = auth.uid()
  )
);

drop policy if exists "prode_private_tournament_join_requests_select_own_or_creator"
  on public.prode_private_tournament_join_requests;
create policy "prode_private_tournament_join_requests_select_own_or_creator"
on public.prode_private_tournament_join_requests for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.prode_private_tournaments t
    where t.id = prode_private_tournament_join_requests.tournament_id
      and t.created_by = auth.uid()
  )
);

drop policy if exists "prode_private_tournament_join_requests_insert_own"
  on public.prode_private_tournament_join_requests;
create policy "prode_private_tournament_join_requests_insert_own"
on public.prode_private_tournament_join_requests for insert
with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "prode_private_tournament_join_requests_update_creator"
  on public.prode_private_tournament_join_requests;
create policy "prode_private_tournament_join_requests_update_creator"
on public.prode_private_tournament_join_requests for update
using (
  exists (
    select 1
    from public.prode_private_tournaments t
    where t.id = prode_private_tournament_join_requests.tournament_id
      and t.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.prode_private_tournaments t
    where t.id = prode_private_tournament_join_requests.tournament_id
      and t.created_by = auth.uid()
  )
);
