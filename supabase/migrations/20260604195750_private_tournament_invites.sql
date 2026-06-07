create table if not exists public.private_tournament_invites (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.prode_private_tournaments(id) on delete cascade,
  token text not null unique,
  email text,
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists private_tournament_invites_tournament_id_idx
  on public.private_tournament_invites(tournament_id);

create index if not exists private_tournament_invites_invited_by_idx
  on public.private_tournament_invites(invited_by);

create index if not exists private_tournament_invites_accepted_by_idx
  on public.private_tournament_invites(accepted_by);

create index if not exists private_tournament_invites_status_idx
  on public.private_tournament_invites(status);

alter table public.private_tournament_invites enable row level security;

drop policy if exists "Tournament owners manage invites" on public.private_tournament_invites;
create policy "Tournament owners manage invites"
  on public.private_tournament_invites
  for all
  using (
    exists (
      select 1
      from public.prode_private_tournament_members members
      where members.tournament_id = private_tournament_invites.tournament_id
        and members.user_id = auth.uid()
        and members.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.prode_private_tournament_members members
      where members.tournament_id = private_tournament_invites.tournament_id
        and members.user_id = auth.uid()
        and members.role in ('owner', 'admin')
    )
  );

drop policy if exists "Invite accepters can read accepted invite" on public.private_tournament_invites;
create policy "Invite accepters can read accepted invite"
  on public.private_tournament_invites
  for select
  using (accepted_by = auth.uid());

do $$
begin
  if exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where proname = 'set_updated_at'
      and pg_namespace.nspname = 'public'
  ) then
    drop trigger if exists set_private_tournament_invites_updated_at on public.private_tournament_invites;
    create trigger set_private_tournament_invites_updated_at
      before update on public.private_tournament_invites
      for each row
      execute function public.set_updated_at();
  end if;
end $$;