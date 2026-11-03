-- Low-risk read-path indexes for Hay Fulbo V2. No schema or data deletion.
-- Focused on joins and common match/tournament queries before opening public traffic.
create index if not exists hf_v2_matches_by_home_date on public.matches(home_team_id, match_date desc) where home_team_id is not null;
create index if not exists hf_v2_matches_by_away_date on public.matches(away_team_id, match_date desc) where away_team_id is not null;
create index if not exists hf_v2_matches_league_date on public.matches(league_id, match_date desc);
create index if not exists hf_v2_matches_source_a on public.matches(source_match_a_id) where source_match_a_id is not null;
create index if not exists hf_v2_matches_source_b on public.matches(source_match_b_id) where source_match_b_id is not null;
create index if not exists hf_v2_leagues_by_competition on public.leagues(competition_id) where competition_id is not null;
create index if not exists hf_v2_match_events_by_team on public.match_events(team_id) where team_id is not null;
create index if not exists hf_v2_copa_champions_team on public.copa_argentina_champions(champion_team_id) where champion_team_id is not null;
create index if not exists hf_v2_copa_runners_up on public.copa_argentina_champions(runner_up_team_id) where runner_up_team_id is not null;
create index if not exists hf_v2_copa_final_match on public.copa_argentina_champions(final_match_id) where final_match_id is not null;
create index if not exists hf_v2_mi_torneito_tournament_date on public.mi_torneito_matches(tournament_id, scheduled_at desc);
create index if not exists hf_v2_mi_torneito_home on public.mi_torneito_matches(home_team_id) where home_team_id is not null;
create index if not exists hf_v2_mi_torneito_away on public.mi_torneito_matches(away_team_id) where away_team_id is not null;
