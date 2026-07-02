create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.pwa_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  device_id text not null,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pwa_push_subscriptions_user_id_idx
  on public.pwa_push_subscriptions(user_id);

create index if not exists pwa_push_subscriptions_device_id_idx
  on public.pwa_push_subscriptions(device_id);

alter table public.pwa_push_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'pwa_push_subscriptions_touch_updated_at'
  ) then
    create trigger pwa_push_subscriptions_touch_updated_at
      before update on public.pwa_push_subscriptions
      for each row
      execute function public.touch_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pwa_push_subscriptions'
      and policyname = 'Users can view own push subscriptions'
  ) then
    create policy "Users can view own push subscriptions"
      on public.pwa_push_subscriptions
      for select
      to authenticated
      using (auth.uid() is not null and auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pwa_push_subscriptions'
      and policyname = 'Users can insert own push subscriptions'
  ) then
    create policy "Users can insert own push subscriptions"
      on public.pwa_push_subscriptions
      for insert
      to authenticated
      with check (auth.uid() is not null and auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pwa_push_subscriptions'
      and policyname = 'Users can update own push subscriptions'
  ) then
    create policy "Users can update own push subscriptions"
      on public.pwa_push_subscriptions
      for update
      to authenticated
      using (auth.uid() is not null and auth.uid() = user_id)
      with check (auth.uid() is not null and auth.uid() = user_id);
  end if;
end;
$$;
