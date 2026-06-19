-- Football API daily usage counters.
-- Additive only: creates one private table and one RPC used by server-side service_role clients.

create table if not exists public.football_api_usage_daily (
  day date not null,
  endpoint text not null,
  context text not null,
  request_count bigint not null default 0,
  success_count bigint not null default 0,
  error_count bigint not null default 0,
  timeout_count bigint not null default 0,
  rate_limit_count bigint not null default 0,
  total_duration_ms bigint not null default 0,
  last_status integer null,
  last_error_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint football_api_usage_daily_pkey primary key (day, endpoint, context)
);

comment on table public.football_api_usage_daily is
  'Daily API-Football request counters by stable endpoint and stable server context. Does not store keys, headers, bodies, provider URLs with secrets, or provider responses.';
comment on column public.football_api_usage_daily.endpoint is
  'Stable API-Football endpoint path, for example /fixtures/events.';
comment on column public.football_api_usage_daily.context is
  'Stable server-side caller context, for example sync-live-matches. Dynamic IDs must not be stored here.';

alter table public.football_api_usage_daily enable row level security;

revoke all on table public.football_api_usage_daily from anon;
revoke all on table public.football_api_usage_daily from authenticated;
grant select, insert, update on table public.football_api_usage_daily to service_role;

create or replace function public.record_football_api_usage(
  p_endpoint text,
  p_context text,
  p_ok boolean,
  p_status integer,
  p_error_code text,
  p_duration_ms integer
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_endpoint text := coalesce(nullif(trim(p_endpoint), ''), 'unknown');
  v_context text := coalesce(nullif(trim(p_context), ''), 'other');
  v_error_code text := nullif(trim(p_error_code), '');
  v_duration_ms integer := greatest(coalesce(p_duration_ms, 0), 0);
begin
  insert into public.football_api_usage_daily (
    day,
    endpoint,
    context,
    request_count,
    success_count,
    error_count,
    timeout_count,
    rate_limit_count,
    total_duration_ms,
    last_status,
    last_error_code
  )
  values (
    current_date,
    v_endpoint,
    v_context,
    1,
    case when p_ok then 1 else 0 end,
    case when p_ok then 0 else 1 end,
    case when v_error_code = 'timeout' then 1 else 0 end,
    case when v_error_code = 'rate_limit' then 1 else 0 end,
    v_duration_ms,
    p_status,
    v_error_code
  )
  on conflict (day, endpoint, context)
  do update set
    request_count = public.football_api_usage_daily.request_count + 1,
    success_count = public.football_api_usage_daily.success_count + excluded.success_count,
    error_count = public.football_api_usage_daily.error_count + excluded.error_count,
    timeout_count = public.football_api_usage_daily.timeout_count + excluded.timeout_count,
    rate_limit_count = public.football_api_usage_daily.rate_limit_count + excluded.rate_limit_count,
    total_duration_ms = public.football_api_usage_daily.total_duration_ms + excluded.total_duration_ms,
    last_status = excluded.last_status,
    last_error_code = excluded.last_error_code,
    updated_at = now();
end;
$$;

comment on function public.record_football_api_usage(text, text, boolean, integer, text, integer) is
  'Atomically increments daily API-Football usage counters. Intended only for service_role server-side callers.';

revoke all on function public.record_football_api_usage(text, text, boolean, integer, text, integer) from public;
revoke all on function public.record_football_api_usage(text, text, boolean, integer, text, integer) from anon;
revoke all on function public.record_football_api_usage(text, text, boolean, integer, text, integer) from authenticated;
grant execute on function public.record_football_api_usage(text, text, boolean, integer, text, integer) to service_role;

-- Rollback, if this additive feature must be removed before production rollout:
-- drop function if exists public.record_football_api_usage(text, text, boolean, integer, text, integer);
-- drop table if exists public.football_api_usage_daily;
