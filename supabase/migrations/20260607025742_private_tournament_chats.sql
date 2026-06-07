create table if not exists public.private_tournament_chats (
  id uuid primary key default gen_random_uuid(),
  private_tournament_id uuid not null references public.prode_private_tournaments(id) on delete cascade,
  title text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint private_tournament_chats_private_tournament_id_key unique (private_tournament_id)
);

create table if not exists public.private_tournament_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.private_tournament_chats(id) on delete cascade,
  private_tournament_id uuid not null references public.prode_private_tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  username text null,
  message_type text not null default 'text',
  message text null,
  sticker_id text null,
  sticker_url text null,
  sticker_label text null,
  created_at timestamptz not null default now(),
  edited_at timestamptz null,
  deleted_at timestamptz null,
  constraint private_tournament_chat_messages_type_check
    check (message_type in ('text', 'sticker')),
  constraint private_tournament_chat_messages_content_check
    check (
      (
        message_type = 'text'
        and length(btrim(coalesce(message, ''))) between 1 and 500
      )
      or (
        message_type = 'sticker'
        and sticker_id is not null
      )
    )
);

create table if not exists public.private_tournament_chat_stickers (
  id text primary key,
  label text not null,
  url text null,
  emoji text null,
  category text null,
  enabled boolean not null default true,
  sort_order integer not null default 0
);

create index if not exists private_tournament_chat_messages_chat_created_idx
  on public.private_tournament_chat_messages (chat_id, created_at desc)
  where deleted_at is null;

create index if not exists private_tournament_chat_messages_tournament_created_idx
  on public.private_tournament_chat_messages (private_tournament_id, created_at desc)
  where deleted_at is null;

alter table public.private_tournament_chats enable row level security;
alter table public.private_tournament_chat_messages enable row level security;
alter table public.private_tournament_chat_stickers enable row level security;

insert into public.private_tournament_chat_stickers (id, label, url, emoji, category, sort_order)
values
  ('ball', 'Pelota', 'emoji:⚽', '⚽', 'Fútbol', 10),
  ('goal', 'Gol', 'emoji:🥅', '🥅', 'Fútbol', 20),
  ('trophy', 'Trofeo', 'emoji:🏆', '🏆', 'Fútbol', 30),
  ('fire', 'Fuego', 'emoji:🔥', '🔥', 'Reacciones', 40),
  ('laugh', 'Risa', 'emoji:😂', '😂', 'Reacciones', 50),
  ('cry', 'Llanto', 'emoji:😭', '😭', 'Reacciones', 60),
  ('vamos', 'Vamos', 'emoji:💪', '💪', 'Prode', 70),
  ('var', 'VAR', 'emoji:📺', '📺', 'Prode', 80),
  ('mufa', 'Mufa', 'emoji:🧂', '🧂', 'Prode', 90),
  ('champion', 'Campeón', 'emoji:⭐', '⭐', 'Prode', 100)
on conflict (id) do update set
  label = excluded.label,
  url = excluded.url,
  emoji = excluded.emoji,
  category = excluded.category,
  sort_order = excluded.sort_order,
  enabled = true;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_updated_at'
  ) then
    drop trigger if exists set_private_tournament_chats_updated_at
      on public.private_tournament_chats;

    create trigger set_private_tournament_chats_updated_at
      before update on public.private_tournament_chats
      for each row
      execute function public.set_updated_at();
  end if;
end $$;
