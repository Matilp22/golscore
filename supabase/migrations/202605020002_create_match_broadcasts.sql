create table if not exists public.match_broadcasts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  broadcaster_name text not null,
  broadcaster_logo_url text,
  country text,
  created_at timestamptz default now(),
  unique (match_id, broadcaster_name)
);

create index if not exists idx_match_broadcasts_match_id
on public.match_broadcasts (match_id);

comment on table public.match_broadcasts is
  'Optional TV channels and streaming platforms shown for matches in Home and match detail.';
