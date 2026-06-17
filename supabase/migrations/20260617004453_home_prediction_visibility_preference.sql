alter table public.profiles
  add column if not exists show_home_predictions boolean not null default false;

comment on column public.profiles.show_home_predictions is
  'User opt-in to show their own saved Prode prediction on public home match rows while signed in.';
