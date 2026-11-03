-- Hay Fulbo V2: identidad de club y preferencias de usuario.
-- Fase aditiva: no reemplaza ni elimina ninguna tabla heredada.
create table if not exists public.hf_club_themes (
  team_external_id bigint primary key check (team_external_id > 0),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  primary_color text not null check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_style text not null default 'minimal'
    check (background_style in ('minimal','diagonal','stripes','gradient','texture')),
  official_logo_url text,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.hf_user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  primary_team_external_id bigint check (primary_team_external_id > 0),
  onboarding_completed boolean not null default false,
  theme_mode text not null default 'tribuna'
    check (theme_mode in ('tribuna','simple')),
  preferred_locale text not null default 'es-AR'
    check (preferred_locale in ('es-AR','en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hf_user_preferences_primary_team_idx
  on public.hf_user_preferences(primary_team_external_id)
  where primary_team_external_id is not null;

create table if not exists public.hf_user_favorite_teams (
  user_id uuid not null references auth.users(id) on delete cascade,
  team_external_id bigint not null check (team_external_id > 0),
  created_at timestamptz not null default now(),
  primary key (user_id,team_external_id)
);
create index if not exists hf_user_favorite_teams_team_idx
  on public.hf_user_favorite_teams(team_external_id);

create table if not exists public.hf_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_alerts boolean not null default true,
  match_start_alerts boolean not null default true,
  match_end_alerts boolean not null default true,
  important_news_alerts boolean not null default false,
  updated_at timestamptz not null default now()
);

create or replace function public.hf_preferences_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger hf_user_preferences_touch_updated_at
before update on public.hf_user_preferences
for each row execute function public.hf_preferences_touch_updated_at();
create trigger hf_notification_preferences_touch_updated_at
before update on public.hf_notification_preferences
for each row execute function public.hf_preferences_touch_updated_at();
create trigger hf_club_themes_touch_updated_at
before update on public.hf_club_themes
for each row execute function public.hf_preferences_touch_updated_at();

alter table public.hf_club_themes enable row level security;
alter table public.hf_user_preferences enable row level security;
alter table public.hf_user_favorite_teams enable row level security;
alter table public.hf_notification_preferences enable row level security;

revoke all on public.hf_club_themes from public, anon, authenticated;
revoke all on public.hf_user_preferences from public, anon, authenticated;
revoke all on public.hf_user_favorite_teams from public, anon, authenticated;
revoke all on public.hf_notification_preferences from public, anon, authenticated;

grant select on public.hf_club_themes to anon, authenticated;
grant select, insert, update, delete on public.hf_user_preferences to authenticated;
grant select, insert, delete on public.hf_user_favorite_teams to authenticated;
grant select, insert, update, delete on public.hf_notification_preferences to authenticated;
grant all on public.hf_club_themes, public.hf_user_preferences,
  public.hf_user_favorite_teams, public.hf_notification_preferences to service_role;

create policy hf_club_themes_public_read
on public.hf_club_themes for select to anon,authenticated
using (is_published);

create policy hf_user_preferences_select_own
on public.hf_user_preferences for select to authenticated
using ((select auth.uid()) = user_id);
create policy hf_user_preferences_insert_own
on public.hf_user_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy hf_user_preferences_update_own
on public.hf_user_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy hf_user_preferences_delete_own
on public.hf_user_preferences for delete to authenticated
using ((select auth.uid()) = user_id);

create policy hf_user_favorite_teams_select_own
on public.hf_user_favorite_teams for select to authenticated
using ((select auth.uid()) = user_id);
create policy hf_user_favorite_teams_insert_own
on public.hf_user_favorite_teams for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy hf_user_favorite_teams_delete_own
on public.hf_user_favorite_teams for delete to authenticated
using ((select auth.uid()) = user_id);

create policy hf_notification_preferences_select_own
on public.hf_notification_preferences for select to authenticated
using ((select auth.uid()) = user_id);
create policy hf_notification_preferences_insert_own
on public.hf_notification_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy hf_notification_preferences_update_own
on public.hf_notification_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy hf_notification_preferences_delete_own
on public.hf_notification_preferences for delete to authenticated
using ((select auth.uid()) = user_id);

revoke execute on function public.hf_preferences_touch_updated_at() from public,anon,authenticated;
comment on table public.hf_club_themes is 'Temas visuales oficiales de clubes; solo lectura de temas publicados; modificaciones vía servidor';
comment on table public.hf_user_preferences is 'Identidad principal de club por usuario; tema tribuna/simple; elección modificable desde configuración';
comment on table public.hf_user_favorite_teams is 'Favoritos del usuario para sincronizar dispositivos; el uso anónimo utiliza almacenamiento local';
comment on table public.hf_notification_preferences is 'Preferencias por tipo de alertas; no implica consentimiento automático a recibir push';
