alter table public.profiles
  alter column audio_enabled set default true;

update public.profiles
set audio_enabled = true
where audio_enabled is distinct from true;

comment on column public.profiles.audio_enabled is
  'User opt-in to enable app sounds, including tournament background audio. Enabled by default for accounts.';
