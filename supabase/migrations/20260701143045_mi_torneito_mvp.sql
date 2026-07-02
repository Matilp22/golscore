create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.mi_torneito_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text,
  contact_email text,
  contact_phone text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mi_torneito_organizations_name_not_blank check (char_length(btrim(name)) > 0),
  constraint mi_torneito_organizations_slug_not_blank check (char_length(btrim(slug)) > 0)
);

create table if not exists public.mi_torneito_tournament_requests (
  id uuid primary key default gen_random_uuid(),
  organizer_name text not null,
  organizer_email text not null,
  organizer_phone text,
  tournament_name text not null,
  city text,
  expected_teams integer,
  notes text,
  status text not null default 'pending',
  admin_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mi_torneito_requests_status_check check (status in ('pending', 'contacted', 'approved', 'rejected', 'archived')),
  constraint mi_torneito_requests_expected_teams_check check (expected_teams is null or expected_teams between 2 and 256),
  constraint mi_torneito_requests_email_check check (organizer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create table if not exists public.mi_torneito_tournaments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.mi_torneito_organizations(id) on delete set null,
  name text not null,
  slug text not null unique,
  short_description text,
  city text,
  venue text,
  season text,
  format text,
  status text not null default 'draft',
  visibility text not null default 'public',
  starts_on date,
  ends_on date,
  logo_url text,
  cover_url text,
  points_win integer not null default 3,
  points_draw integer not null default 1,
  points_loss integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint mi_torneito_tournaments_status_check check (status in ('draft', 'scheduled', 'active', 'finished', 'archived')),
  constraint mi_torneito_tournaments_visibility_check check (visibility in ('public', 'unlisted', 'private')),
  constraint mi_torneito_tournaments_name_not_blank check (char_length(btrim(name)) > 0),
  constraint mi_torneito_tournaments_slug_not_blank check (char_length(btrim(slug)) > 0)
);

create table if not exists public.mi_torneito_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.mi_torneito_tournaments(id) on delete cascade,
  name text not null,
  slug text not null,
  logo_url text,
  primary_color text,
  coach_name text,
  home_venue text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, slug),
  constraint mi_torneito_teams_name_not_blank check (char_length(btrim(name)) > 0),
  constraint mi_torneito_teams_slug_not_blank check (char_length(btrim(slug)) > 0)
);

create table if not exists public.mi_torneito_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.mi_torneito_tournaments(id) on delete cascade,
  name text not null,
  slug text not null,
  phase text not null default 'group',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, slug),
  constraint mi_torneito_rounds_phase_check check (phase in ('group', 'knockout', 'final')),
  constraint mi_torneito_rounds_name_not_blank check (char_length(btrim(name)) > 0)
);

create table if not exists public.mi_torneito_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.mi_torneito_tournaments(id) on delete cascade,
  round_id uuid references public.mi_torneito_rounds(id) on delete set null,
  home_team_id uuid references public.mi_torneito_teams(id) on delete set null,
  away_team_id uuid references public.mi_torneito_teams(id) on delete set null,
  scheduled_at timestamptz,
  venue text,
  status text not null default 'scheduled',
  home_score integer,
  away_score integer,
  home_penalty_score integer,
  away_penalty_score integer,
  minute integer,
  broadcast_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mi_torneito_matches_status_check check (status in ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
  constraint mi_torneito_matches_score_check check (
    (home_score is null and away_score is null)
    or (home_score >= 0 and away_score >= 0)
  ),
  constraint mi_torneito_matches_teams_different_check check (
    home_team_id is null or away_team_id is null or home_team_id <> away_team_id
  )
);

create table if not exists public.mi_torneito_tournament_admins (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.mi_torneito_tournaments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'editor',
  active boolean not null default true,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, email),
  constraint mi_torneito_tournament_admins_role_check check (role in ('owner', 'editor')),
  constraint mi_torneito_tournament_admins_email_check check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create table if not exists public.mi_torneito_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.mi_torneito_tournaments(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mi_torneito_requests_status_created_idx
  on public.mi_torneito_tournament_requests(status, created_at desc);

create index if not exists mi_torneito_tournaments_public_idx
  on public.mi_torneito_tournaments(visibility, status, starts_on)
  where deleted_at is null;

create index if not exists mi_torneito_teams_tournament_idx
  on public.mi_torneito_teams(tournament_id, name);

create index if not exists mi_torneito_rounds_tournament_idx
  on public.mi_torneito_rounds(tournament_id, sort_order, name);

create index if not exists mi_torneito_matches_tournament_idx
  on public.mi_torneito_matches(tournament_id, scheduled_at);

create index if not exists mi_torneito_tournament_admins_user_idx
  on public.mi_torneito_tournament_admins(user_id, active);

create index if not exists mi_torneito_tournament_admins_email_idx
  on public.mi_torneito_tournament_admins(lower(email), active);

drop trigger if exists mi_torneito_organizations_touch_updated_at on public.mi_torneito_organizations;
create trigger mi_torneito_organizations_touch_updated_at
before update on public.mi_torneito_organizations
for each row execute function public.touch_updated_at();

drop trigger if exists mi_torneito_tournament_requests_touch_updated_at on public.mi_torneito_tournament_requests;
create trigger mi_torneito_tournament_requests_touch_updated_at
before update on public.mi_torneito_tournament_requests
for each row execute function public.touch_updated_at();

drop trigger if exists mi_torneito_tournaments_touch_updated_at on public.mi_torneito_tournaments;
create trigger mi_torneito_tournaments_touch_updated_at
before update on public.mi_torneito_tournaments
for each row execute function public.touch_updated_at();

drop trigger if exists mi_torneito_teams_touch_updated_at on public.mi_torneito_teams;
create trigger mi_torneito_teams_touch_updated_at
before update on public.mi_torneito_teams
for each row execute function public.touch_updated_at();

drop trigger if exists mi_torneito_rounds_touch_updated_at on public.mi_torneito_rounds;
create trigger mi_torneito_rounds_touch_updated_at
before update on public.mi_torneito_rounds
for each row execute function public.touch_updated_at();

drop trigger if exists mi_torneito_matches_touch_updated_at on public.mi_torneito_matches;
create trigger mi_torneito_matches_touch_updated_at
before update on public.mi_torneito_matches
for each row execute function public.touch_updated_at();

drop trigger if exists mi_torneito_tournament_admins_touch_updated_at on public.mi_torneito_tournament_admins;
create trigger mi_torneito_tournament_admins_touch_updated_at
before update on public.mi_torneito_tournament_admins
for each row execute function public.touch_updated_at();

alter table public.mi_torneito_organizations enable row level security;
alter table public.mi_torneito_tournament_requests enable row level security;
alter table public.mi_torneito_tournaments enable row level security;
alter table public.mi_torneito_teams enable row level security;
alter table public.mi_torneito_rounds enable row level security;
alter table public.mi_torneito_matches enable row level security;
alter table public.mi_torneito_tournament_admins enable row level security;
alter table public.mi_torneito_audit_logs enable row level security;

drop policy if exists "mi_torneito_public_read_organizations" on public.mi_torneito_organizations;
create policy "mi_torneito_public_read_organizations"
on public.mi_torneito_organizations for select
to anon, authenticated
using (active = true);

drop policy if exists "mi_torneito_public_insert_requests" on public.mi_torneito_tournament_requests;
create policy "mi_torneito_public_insert_requests"
on public.mi_torneito_tournament_requests for insert
to anon, authenticated
with check (status = 'pending');

drop policy if exists "mi_torneito_public_read_tournaments" on public.mi_torneito_tournaments;
create policy "mi_torneito_public_read_tournaments"
on public.mi_torneito_tournaments for select
to anon, authenticated
using (deleted_at is null and visibility in ('public', 'unlisted'));

drop policy if exists "mi_torneito_public_read_teams" on public.mi_torneito_teams;
create policy "mi_torneito_public_read_teams"
on public.mi_torneito_teams for select
to anon, authenticated
using (
  exists (
    select 1 from public.mi_torneito_tournaments t
    where t.id = mi_torneito_teams.tournament_id
      and t.deleted_at is null
      and t.visibility in ('public', 'unlisted')
  )
);

drop policy if exists "mi_torneito_public_read_rounds" on public.mi_torneito_rounds;
create policy "mi_torneito_public_read_rounds"
on public.mi_torneito_rounds for select
to anon, authenticated
using (
  exists (
    select 1 from public.mi_torneito_tournaments t
    where t.id = mi_torneito_rounds.tournament_id
      and t.deleted_at is null
      and t.visibility in ('public', 'unlisted')
  )
);

drop policy if exists "mi_torneito_public_read_matches" on public.mi_torneito_matches;
create policy "mi_torneito_public_read_matches"
on public.mi_torneito_matches for select
to anon, authenticated
using (
  exists (
    select 1 from public.mi_torneito_tournaments t
    where t.id = mi_torneito_matches.tournament_id
      and t.deleted_at is null
      and t.visibility in ('public', 'unlisted')
  )
);

drop policy if exists "mi_torneito_admins_read_self" on public.mi_torneito_tournament_admins;
create policy "mi_torneito_admins_read_self"
on public.mi_torneito_tournament_admins for select
to authenticated
using (active = true and user_id = (select auth.uid()));

drop policy if exists "mi_torneito_admins_manage_teams" on public.mi_torneito_teams;
create policy "mi_torneito_admins_manage_teams"
on public.mi_torneito_teams for all
to authenticated
using (
  exists (
    select 1 from public.mi_torneito_tournament_admins a
    where a.tournament_id = mi_torneito_teams.tournament_id
      and a.user_id = (select auth.uid())
      and a.active = true
  )
)
with check (
  exists (
    select 1 from public.mi_torneito_tournament_admins a
    where a.tournament_id = mi_torneito_teams.tournament_id
      and a.user_id = (select auth.uid())
      and a.active = true
  )
);

drop policy if exists "mi_torneito_admins_manage_rounds" on public.mi_torneito_rounds;
create policy "mi_torneito_admins_manage_rounds"
on public.mi_torneito_rounds for all
to authenticated
using (
  exists (
    select 1 from public.mi_torneito_tournament_admins a
    where a.tournament_id = mi_torneito_rounds.tournament_id
      and a.user_id = (select auth.uid())
      and a.active = true
  )
)
with check (
  exists (
    select 1 from public.mi_torneito_tournament_admins a
    where a.tournament_id = mi_torneito_rounds.tournament_id
      and a.user_id = (select auth.uid())
      and a.active = true
  )
);

drop policy if exists "mi_torneito_admins_manage_matches" on public.mi_torneito_matches;
create policy "mi_torneito_admins_manage_matches"
on public.mi_torneito_matches for all
to authenticated
using (
  exists (
    select 1 from public.mi_torneito_tournament_admins a
    where a.tournament_id = mi_torneito_matches.tournament_id
      and a.user_id = (select auth.uid())
      and a.active = true
  )
)
with check (
  exists (
    select 1 from public.mi_torneito_tournament_admins a
    where a.tournament_id = mi_torneito_matches.tournament_id
      and a.user_id = (select auth.uid())
      and a.active = true
  )
);

grant select on table public.mi_torneito_organizations to anon, authenticated;
grant insert on table public.mi_torneito_tournament_requests to anon, authenticated;
grant select on table public.mi_torneito_tournaments to anon, authenticated;
grant select on table public.mi_torneito_teams to anon, authenticated;
grant select on table public.mi_torneito_rounds to anon, authenticated;
grant select on table public.mi_torneito_matches to anon, authenticated;

grant select, insert, update, delete on table public.mi_torneito_organizations to service_role;
grant select, insert, update, delete on table public.mi_torneito_tournament_requests to service_role;
grant select, insert, update, delete on table public.mi_torneito_tournaments to service_role;
grant select, insert, update, delete on table public.mi_torneito_teams to service_role;
grant select, insert, update, delete on table public.mi_torneito_rounds to service_role;
grant select, insert, update, delete on table public.mi_torneito_matches to service_role;
grant select, insert, update, delete on table public.mi_torneito_tournament_admins to service_role;
grant select, insert, update, delete on table public.mi_torneito_audit_logs to service_role;

comment on table public.mi_torneito_tournament_requests is
  'Public concierge requests for Mi Torneito. Public users can insert pending requests only.';

comment on table public.mi_torneito_tournaments is
  'User-created football tournaments managed from Hay Fulbo Mi Torneito.';
