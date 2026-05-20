alter table public.matches
  add column if not exists last_events_synced_at timestamptz,
  add column if not exists last_statistics_synced_at timestamptz,
  add column if not exists last_lineups_synced_at timestamptz,
  add column if not exists final_detail_synced_at timestamptz,
  add column if not exists final_followup_synced_at timestamptz;

create index if not exists idx_matches_live_sync_status_date
on public.matches (status, match_date);

create index if not exists idx_matches_live_sync_events
on public.matches (last_events_synced_at)
where status in ('LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT');

create index if not exists idx_matches_live_sync_final_detail
on public.matches (final_detail_synced_at)
where status in ('FT', 'AET', 'PEN');
