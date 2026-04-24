drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "prediction_scores_select_public" on public.prediction_scores;
drop policy if exists "prediction_scores_select_own" on public.prediction_scores;
create policy "prediction_scores_select_own"
on public.prediction_scores for select
using (auth.uid() = user_id);

drop policy if exists "points_select_public" on public.points;
drop policy if exists "points_select_own" on public.points;
create policy "points_select_own"
on public.points for select
using (auth.uid() = user_id);

drop policy if exists "leaderboards_select_public" on public.leaderboards;
create policy "leaderboards_select_public"
on public.leaderboards for select
using (true);

drop policy if exists "public_read_results" on public.results;
create policy "public_read_results"
on public.results for select
using (true);

drop policy if exists "public_read_competitions" on public.competitions;
create policy "public_read_competitions"
on public.competitions for select
using (true);

drop policy if exists "public_read_leagues" on public.leagues;
create policy "public_read_leagues"
on public.leagues for select
using (true);

drop policy if exists "public_read_teams" on public.teams;
create policy "public_read_teams"
on public.teams for select
using (true);

drop policy if exists "public_read_matches" on public.matches;
create policy "public_read_matches"
on public.matches for select
using (true);
