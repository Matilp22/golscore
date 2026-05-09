create or replace function public.normalize_prode_private_tournament_name(input_name text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(input_name, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.prode_private_tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

alter table public.prode_private_tournaments
  add column if not exists base_name text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prode_private_tournaments'
      and column_name = 'league_id'
      and udt_name <> 'uuid'
  ) then
    alter table public.prode_private_tournaments
      drop constraint if exists prode_private_tournaments_league_id_fkey;

    alter table public.prode_private_tournaments
      drop column league_id;
  end if;

  alter table public.prode_private_tournaments
    add column if not exists league_id uuid;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'prode_private_tournaments_league_id_fkey'
      and conrelid = 'public.prode_private_tournaments'::regclass
  ) then
    alter table public.prode_private_tournaments
      add constraint prode_private_tournaments_league_id_fkey
      foreign key (league_id) references public.leagues(id) on delete set null;
  end if;
end;
$$;

alter table public.prode_private_tournaments
  add column if not exists league_external_id text;

alter table public.prode_private_tournaments
  add column if not exists league_name text;

alter table public.prode_private_tournaments
  add column if not exists display_name text;

with default_league as (
  select
    l.id,
    l.external_id::text as external_id,
    coalesce(l.name, 'Liga Profesional Argentina') as name
  from public.leagues l
  where l.external_id::text = '128'
  order by l.season desc nulls last, l.id desc
  limit 1
)
update public.prode_private_tournaments t
set
  base_name = coalesce(nullif(btrim(t.base_name), ''), t.name),
  league_id = coalesce(t.league_id, (select id from default_league)),
  league_external_id = coalesce(nullif(btrim(t.league_external_id), ''), (select external_id from default_league), '128'),
  league_name = coalesce(nullif(btrim(t.league_name), ''), (select name from default_league), 'Liga Profesional Argentina')
where
  t.base_name is null
  or nullif(btrim(t.base_name), '') is null
  or t.league_external_id is null
  or nullif(btrim(t.league_external_id), '') is null
  or t.league_name is null
  or nullif(btrim(t.league_name), '') is null;

update public.prode_private_tournaments
set
  base_name = regexp_replace(btrim(base_name), '\s+', ' ', 'g'),
  league_name = regexp_replace(btrim(league_name), '\s+', ' ', 'g'),
  display_name = regexp_replace(btrim(base_name), '\s+', ' ', 'g')
    || ' - '
    || regexp_replace(btrim(league_name), '\s+', ' ', 'g')
where
  display_name is null
  or display_name <> regexp_replace(btrim(base_name), '\s+', ' ', 'g')
    || ' - '
    || regexp_replace(btrim(league_name), '\s+', ' ', 'g');

update public.prode_private_tournaments
set
  name = display_name,
  normalized_name = public.normalize_prode_private_tournament_name(display_name)
where name <> display_name
  or normalized_name <> public.normalize_prode_private_tournament_name(display_name);

alter table public.prode_private_tournaments
  alter column base_name set not null;

alter table public.prode_private_tournaments
  alter column league_external_id set not null;

alter table public.prode_private_tournaments
  alter column league_name set not null;

alter table public.prode_private_tournaments
  alter column display_name set not null;

alter table public.prode_private_tournaments
  drop constraint if exists prode_private_tournaments_name_not_blank;

alter table public.prode_private_tournaments
  add constraint prode_private_tournaments_name_not_blank check (
    char_length(public.normalize_prode_private_tournament_name(display_name)) > 0
  );

create or replace function public.set_prode_private_tournament_normalized_name()
returns trigger
language plpgsql
as $$
begin
  new.base_name = regexp_replace(btrim(coalesce(new.base_name, new.name)), '\s+', ' ', 'g');
  new.league_name = regexp_replace(btrim(coalesce(new.league_name, 'Liga Profesional Argentina')), '\s+', ' ', 'g');
  new.league_external_id = nullif(btrim(new.league_external_id), '');
  new.display_name = new.base_name || ' - ' || new.league_name;
  new.name = new.display_name;
  new.normalized_name = public.normalize_prode_private_tournament_name(new.display_name);

  if new.normalized_name = '' then
    raise exception 'El nombre del torneo no puede estar vacio';
  end if;

  return new;
end;
$$;

drop trigger if exists prode_private_tournaments_normalize_name
  on public.prode_private_tournaments;
create trigger prode_private_tournaments_normalize_name
before insert or update of name, base_name, league_name, league_external_id
on public.prode_private_tournaments
for each row execute function public.set_prode_private_tournament_normalized_name();

drop trigger if exists prode_private_tournaments_touch_updated_at
  on public.prode_private_tournaments;
create trigger prode_private_tournaments_touch_updated_at
before update on public.prode_private_tournaments
for each row execute function public.touch_updated_at();

create index if not exists idx_prode_private_tournaments_league_external_id
  on public.prode_private_tournaments(league_external_id);

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
