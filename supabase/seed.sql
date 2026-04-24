insert into public.competitions (name, country)
values ('Liga Profesional', 'Argentina')
on conflict do nothing;

insert into public.leagues (external_id, name, country, season)
values
  (128, 'Liga Profesional Argentina', 'Argentina', 2026),
  (129, 'Primera B Nacional', 'Argentina', 2026),
  (1, 'Mundial 2026', 'Mundo', 2026)
on conflict (external_id) do update set
  name = excluded.name,
  country = excluded.country,
  season = excluded.season;
