alter table public.profiles
  add column if not exists audio_enabled boolean not null default false;

comment on column public.profiles.audio_enabled is
  'User opt-in to enable app sounds, including tournament background audio.';
