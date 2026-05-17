create table if not exists public.tournament_champions (
  id bigserial primary key,
  competition_key text not null,
  season text not null,
  champion_name text not null,
  runner_up_name text not null,
  final_score text,
  champion_team_id bigint references public.teams(id) on delete set null,
  runner_up_team_id bigint references public.teams(id) on delete set null,
  final_match_id bigint references public.matches(id) on delete set null,
  venue text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_champions_competition_season_unique unique (competition_key, season)
);

create index if not exists idx_tournament_champions_competition
on public.tournament_champions (competition_key, season desc);

alter table public.tournament_champions enable row level security;

drop policy if exists "public_read_tournament_champions" on public.tournament_champions;
create policy "public_read_tournament_champions"
on public.tournament_champions for select
using (true);

grant select on public.tournament_champions to anon, authenticated;
grant select, insert, update, delete on public.tournament_champions to service_role;
grant usage, select on sequence public.tournament_champions_id_seq to service_role;

drop trigger if exists tournament_champions_touch_updated_at on public.tournament_champions;
create trigger tournament_champions_touch_updated_at
before update on public.tournament_champions
for each row execute function public.touch_updated_at();

insert into public.tournament_champions (
  competition_key,
  season,
  champion_name,
  runner_up_name,
  final_score,
  venue
)
values
  ('internacional-libertadores', '2025', 'Flamengo', 'Palmeiras', '1-0', 'Lima, Peru'),
  ('internacional-libertadores', '2024', 'Botafogo', 'Atletico Mineiro', '3-1', 'Buenos Aires, Argentina'),
  ('internacional-libertadores', '2023', 'Fluminense', 'Boca Juniors', '2-1 (a.e.t.)', 'Rio de Janeiro, Brasil'),
  ('internacional-libertadores', '2022', 'Flamengo', 'Athletico Paranaense', '1-0', 'Guayaquil, Ecuador'),
  ('internacional-libertadores', '2021', 'Palmeiras', 'Flamengo', '2-1 (a.e.t.)', 'Montevideo, Uruguay'),
  ('internacional-libertadores', '2020', 'Palmeiras', 'Santos', '1-0', 'Rio de Janeiro, Brasil'),
  ('internacional-libertadores', '2019', 'Flamengo', 'River Plate', '2-1', 'Lima, Peru'),
  ('internacional-libertadores', '2018', 'River Plate', 'Boca Juniors', '5-3 agg.', 'Buenos Aires / Madrid'),
  ('internacional-libertadores', '2017', 'Gremio', 'Lanus', '3-1 agg.', null),
  ('internacional-libertadores', '2016', 'Atletico Nacional', 'Independiente del Valle', '2-1 agg.', null),
  ('internacional-libertadores', '2015', 'River Plate', 'UANL', '3-0 agg.', null),
  ('internacional-libertadores', '2014', 'San Lorenzo', 'Nacional', '2-1 agg.', null),
  ('internacional-libertadores', '2013', 'Atletico Mineiro', 'Olimpia', '2-2 (4-3 pen.)', null),
  ('internacional-libertadores', '2012', 'Corinthians', 'Boca Juniors', '3-1 agg.', null),
  ('internacional-libertadores', '2011', 'Santos', 'Penarol', '2-1 agg.', null),
  ('internacional-libertadores', '2010', 'Internacional', 'Guadalajara', '5-3 agg.', null),
  ('internacional-libertadores', '2009', 'Estudiantes', 'Cruzeiro', '2-1 agg.', null),
  ('internacional-libertadores', '2008', 'Liga de Quito', 'Fluminense', '5-5 (3-1 pen.)', null),
  ('internacional-libertadores', '2007', 'Boca Juniors', 'Gremio', '5-0 agg.', null),
  ('internacional-libertadores', '2006', 'Internacional', 'Sao Paulo', '4-3 agg.', null),
  ('internacional-libertadores', '2005', 'Sao Paulo', 'Athletico Paranaense', '5-1 agg.', null),
  ('internacional-libertadores', '2004', 'Once Caldas', 'Boca Juniors', '1-1 (2-0 pen.)', null),
  ('internacional-libertadores', '2003', 'Boca Juniors', 'Santos', '5-1 agg.', null),
  ('internacional-libertadores', '2002', 'Olimpia', 'Sao Caetano', '2-2 (4-2 pen.)', null),
  ('internacional-libertadores', '2001', 'Boca Juniors', 'Cruz Azul', '1-1 (3-1 pen.)', null),
  ('internacional-libertadores', '2000', 'Boca Juniors', 'Palmeiras', '2-2 (4-2 pen.)', null),
  ('internacional-libertadores', '1999', 'Palmeiras', 'Deportivo Cali', '2-2 (4-3 pen.)', null),
  ('internacional-libertadores', '1998', 'Vasco da Gama', 'Barcelona SC', '4-1 agg.', null),
  ('internacional-libertadores', '1997', 'Cruzeiro', 'Sporting Cristal', '1-0 agg.', null),
  ('internacional-libertadores', '1996', 'River Plate', 'America de Cali', '2-1 agg.', null),
  ('internacional-libertadores', '1995', 'Gremio', 'Atletico Nacional', '4-2 agg.', null),
  ('internacional-libertadores', '1994', 'Velez Sarsfield', 'Sao Paulo', '1-1 (5-3 pen.)', null),
  ('internacional-libertadores', '1993', 'Sao Paulo', 'Universidad Catolica', '5-3 agg.', null),
  ('internacional-libertadores', '1992', 'Sao Paulo', 'Newell''s Old Boys', '1-1 (3-2 pen.)', null),
  ('internacional-libertadores', '1991', 'Colo-Colo', 'Olimpia', '3-0 agg.', null),
  ('internacional-libertadores', '1990', 'Olimpia', 'Barcelona SC', '3-1 agg.', null),
  ('internacional-libertadores', '1989', 'Atletico Nacional', 'Olimpia', '2-2 (5-4 pen.)', null),
  ('internacional-libertadores', '1988', 'Nacional', 'Newell''s Old Boys', '3-1 agg.', null),
  ('internacional-libertadores', '1987', 'Penarol', 'America de Cali', '1-0 playoff', null),
  ('internacional-libertadores', '1986', 'River Plate', 'America de Cali', '3-1 agg.', null),
  ('internacional-libertadores', '1985', 'Argentinos Juniors', 'America de Cali', '2-2 (5-4 pen.)', null),
  ('internacional-libertadores', '1984', 'Independiente', 'Gremio', '1-0 agg.', null),
  ('internacional-libertadores', '1983', 'Gremio', 'Penarol', '3-2 agg.', null),
  ('internacional-libertadores', '1982', 'Penarol', 'Cobreloa', '1-0 agg.', null),
  ('internacional-libertadores', '1981', 'Flamengo', 'Cobreloa', '2-0 playoff', null),
  ('internacional-libertadores', '1980', 'Nacional', 'Internacional', '1-0 agg.', null),
  ('internacional-libertadores', '1979', 'Olimpia', 'Boca Juniors', '2-0 agg.', null),
  ('internacional-libertadores', '1978', 'Boca Juniors', 'Deportivo Cali', '4-0 agg.', null),
  ('internacional-libertadores', '1977', 'Boca Juniors', 'Cruzeiro', '1-1 (5-4 pen.)', null),
  ('internacional-libertadores', '1976', 'Cruzeiro', 'River Plate', '3-2 playoff', null),
  ('internacional-libertadores', '1975', 'Independiente', 'Union Espanola', '2-0 playoff', null),
  ('internacional-libertadores', '1974', 'Independiente', 'Sao Paulo', '1-0 playoff', null),
  ('internacional-libertadores', '1973', 'Independiente', 'Colo-Colo', '2-1 playoff', null),
  ('internacional-libertadores', '1972', 'Independiente', 'Universitario', '2-1 agg.', null),
  ('internacional-libertadores', '1971', 'Nacional', 'Estudiantes', '2-0 playoff', null),
  ('internacional-libertadores', '1970', 'Estudiantes', 'Penarol', '1-0 agg.', null),
  ('internacional-libertadores', '1969', 'Estudiantes', 'Nacional', '3-0 agg.', null),
  ('internacional-libertadores', '1968', 'Estudiantes', 'Palmeiras', '2-0 playoff', null),
  ('internacional-libertadores', '1967', 'Racing Club', 'Nacional', '2-1 playoff', null),
  ('internacional-libertadores', '1966', 'Penarol', 'River Plate', '4-2 playoff', null),
  ('internacional-libertadores', '1965', 'Independiente', 'Penarol', '4-1 playoff', null),
  ('internacional-libertadores', '1964', 'Independiente', 'Nacional', '1-0 agg.', null),
  ('internacional-libertadores', '1963', 'Santos', 'Boca Juniors', '5-3 agg.', null),
  ('internacional-libertadores', '1962', 'Santos', 'Penarol', '3-0 playoff', null),
  ('internacional-libertadores', '1961', 'Penarol', 'Palmeiras', '2-1 agg.', null),
  ('internacional-libertadores', '1960', 'Penarol', 'Olimpia', '2-1 agg.', null),
  ('internacional-sudamericana', '2025', 'Lanus', 'Atletico Mineiro', '0-0 (5-4 pen.)', 'Asuncion, Paraguay'),
  ('internacional-sudamericana', '2024', 'Racing Club', 'Cruzeiro', '3-1', 'Asuncion, Paraguay'),
  ('internacional-sudamericana', '2023', 'Liga de Quito', 'Fortaleza', '1-1 (4-3 pen.)', 'Punta del Este, Uruguay'),
  ('internacional-sudamericana', '2022', 'Independiente del Valle', 'Sao Paulo', '2-0', 'Cordoba, Argentina'),
  ('internacional-sudamericana', '2021', 'Athletico Paranaense', 'Red Bull Bragantino', '1-0', 'Montevideo, Uruguay'),
  ('internacional-sudamericana', '2020', 'Defensa y Justicia', 'Lanus', '3-0', 'Cordoba, Argentina'),
  ('internacional-sudamericana', '2019', 'Independiente del Valle', 'Colon', '3-1', 'Asuncion, Paraguay'),
  ('internacional-sudamericana', '2018', 'Athletico Paranaense', 'Junior', '2-2 (4-3 pen.)', null),
  ('internacional-sudamericana', '2017', 'Independiente', 'Flamengo', '3-2 agg.', null),
  ('internacional-sudamericana', '2016', 'Chapecoense', 'Atletico Nacional', 'Titulo otorgado por CONMEBOL', null),
  ('internacional-sudamericana', '2015', 'Santa Fe', 'Huracan', '0-0 (3-1 pen.)', 'Bogota, Colombia'),
  ('internacional-sudamericana', '2014', 'River Plate', 'Atletico Nacional', '3-1 agg.', null),
  ('internacional-sudamericana', '2013', 'Lanus', 'Ponte Preta', '3-1 agg.', null),
  ('internacional-sudamericana', '2012', 'Sao Paulo', 'Tigre', '2-0 agg.', null),
  ('internacional-sudamericana', '2011', 'Universidad de Chile', 'Liga de Quito', '4-0 agg.', null),
  ('internacional-sudamericana', '2010', 'Independiente', 'Goias', '3-3 (5-3 pen.)', null),
  ('internacional-sudamericana', '2009', 'Liga de Quito', 'Fluminense', '5-4 agg.', null),
  ('internacional-sudamericana', '2008', 'Internacional', 'Estudiantes', '2-1 agg.', null),
  ('internacional-sudamericana', '2007', 'Arsenal', 'America', '4-4 agg. (away goals)', null),
  ('internacional-sudamericana', '2006', 'Pachuca', 'Colo-Colo', '3-2 agg.', null),
  ('internacional-sudamericana', '2005', 'Boca Juniors', 'UNAM', '2-2 (4-3 pen.)', null),
  ('internacional-sudamericana', '2004', 'Boca Juniors', 'Bolivar', '2-1 agg.', null),
  ('internacional-sudamericana', '2003', 'Cienciano', 'River Plate', '4-3 agg.', null),
  ('internacional-sudamericana', '2002', 'San Lorenzo', 'Atletico Nacional', '4-0 agg.', null)
on conflict (competition_key, season) do update set
  champion_name = excluded.champion_name,
  runner_up_name = excluded.runner_up_name,
  final_score = excluded.final_score,
  venue = excluded.venue,
  updated_at = now();
