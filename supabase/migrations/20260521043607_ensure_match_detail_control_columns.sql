alter table public.matches
  add column if not exists last_events_synced_at timestamptz,
  add column if not exists last_statistics_synced_at timestamptz,
  add column if not exists last_lineups_synced_at timestamptz,
  add column if not exists detail_last_synced_at timestamptz,
  add column if not exists final_detail_synced_at timestamptz;
