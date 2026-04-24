alter table public.predictions
  add column if not exists updated_at timestamp with time zone default now();

update public.predictions
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.predictions
  alter column updated_at set default now();

alter table public.predictions
  alter column updated_at set not null;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists predictions_touch_updated_at on public.predictions;

create trigger predictions_touch_updated_at
before update on public.predictions
for each row execute function public.touch_updated_at();
