-- Hay Fulbo | Motor de crónicas postpartido
-- Aplicar al Supabase real antes de habilitar el cron.
create extension if not exists pgcrypto;

create table if not exists public.hf_match_news_jobs (
  fixture_id bigint primary key,
  league_id integer not null,
  first_seen_final_at timestamptz not null default now(),
  state text not null default 'queued' check (state in ('queued','processing','retry','done','failed')),
  attempts integer not null default 0,
  leased_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  updated_at timestamptz not null default now()
);

create table if not exists public.hf_match_news_articles (
  id uuid primary key default gen_random_uuid(),
  fixture_id bigint not null unique,
  league_id integer not null,
  slug text not null unique,
  title text not null check (char_length(title) between 8 and 160),
  summary text not null,
  body text not null,
  league text not null,
  home_team text not null,
  away_team text not null,
  home_logo text,
  away_logo text,
  home_goals integer not null,
  away_goals integer not null,
  kickoff_at timestamptz not null,
  facts jsonb not null,
  origin text not null default 'openai',
  status text not null default 'draft' check (status in ('draft','published','hidden')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hf_match_news_articles_feed on public.hf_match_news_articles (status,published_at desc);
create index if not exists hf_match_news_articles_fixture on public.hf_match_news_articles (fixture_id);
create index if not exists hf_match_news_jobs_queue on public.hf_match_news_jobs (state,next_attempt_at,first_seen_final_at);

alter table public.hf_match_news_jobs enable row level security;
alter table public.hf_match_news_articles enable row level security;

revoke all on public.hf_match_news_jobs from public,anon,authenticated;
revoke insert,update,delete on public.hf_match_news_articles from public,anon,authenticated;
grant select on public.hf_match_news_articles to anon,authenticated;
drop policy if exists hf_match_news_public_select on public.hf_match_news_articles;
create policy hf_match_news_public_select on public.hf_match_news_articles
  for select to anon,authenticated using (status='published');

create or replace function public.hf_claim_match_news(p_limit integer default 2)
returns setof public.hf_match_news_jobs
language sql security invoker set search_path=''
as $$
  with selection as (
    select fixture_id from public.hf_match_news_jobs
    where first_seen_final_at <= now() - interval '4 minutes'
      and (
        (state in ('queued','retry') and next_attempt_at <= now())
        or (state='processing' and leased_at < now() - interval '7 minutes')
      )
    order by first_seen_final_at asc
    for update skip locked
    limit least(greatest(p_limit,1),3)
  )
  update public.hf_match_news_jobs j
     set state='processing',leased_at=now(),attempts=attempts+1,updated_at=now()
    from selection s where j.fixture_id=s.fixture_id returning j.*;
$$;
revoke all on function public.hf_claim_match_news(integer) from public,anon,authenticated;
grant execute on function public.hf_claim_match_news(integer) to service_role;

comment on table public.hf_match_news_articles is 'Hay Fulbo: noticia generada por partido; lectura pública limitada por RLS al estado published';
