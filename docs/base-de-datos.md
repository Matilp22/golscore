# Base de datos

La base productiva usa Supabase Postgres con Auth.

Convencion final:

- Codigo interno, tablas, columnas, types, services, hooks y queries en ingles.
- Interfaz visible al usuario en espanol.
- No se usan tablas en espanol desde la app.

## Tablas

- `profiles`: perfil del usuario autenticado.
- `competitions`: competiciones generales por pais o bloque.
- `leagues`: liga o torneo por temporada.
- `teams`: equipos.
- `matches`: partidos normalizados para prode y resultados.
- `predictions`: una prediccion por usuario y partido.
- `prediction_scores`: puntaje calculado por prediccion.
- `results`: resultado final normalizado por partido.
- `points`: tabla final de puntos por prediccion.
- `leaderboards`: ranking materializado por usuario.

Campos principales del prode:

- `matches.match_date`: fecha y hora de inicio del partido.
- `leagues.external_id`, `teams.external_id`, `matches.external_id`: IDs de API-Football usados para upsert sin duplicados.
- `leagues.season`: temporada sincronizada.
- `matches.round`: fecha, jornada o ronda del torneo.
- `matches.league_id`, `home_team_id`, `away_team_id`: relaciones del partido.
- `predictions.predicted_home_score`, `predicted_away_score`: pronostico del usuario.
- `points.points`, `exact_hit`, `partial_hit`: puntaje calculado.

## Vista

- `leaderboard`: vista de compatibilidad que lee desde `leaderboards`.

## Seguridad

RLS queda activo. Los usuarios pueden leer datos publicos de competiciones, ligas, equipos, partidos, resultados y ranking. Cada usuario solo puede leer/modificar su propio `profile`, sus propias `predictions` y sus propios `points`. El bloqueo de 15 minutos esta reforzado por trigger en `predictions`.

Las escrituras de partidos, resultados y recalculo de puntos deben hacerse con service role desde jobs/functions, no desde el cliente.

## Migraciones

- `202604210001_base_prode.sql`: base inicial de perfiles, entidades, predicciones, scoring y RLS.
- `202604210002_complete_prode_tables.sql`: agrega `results`, `points`, `leaderboards`, trigger de perfil y recalculo completo.
- `202604210003_align_rls_for_frontend.sql`: ajusta RLS final para perfiles/puntos propios y lectura publica de datos deportivos.
- `202604220001_normalize_prode_english.sql`: migracion no destructiva que normaliza instalaciones previas. Si existen tablas en espanol (`ligas`, `equipos`, `partidos`, `predicciones`, `perfiles`, `puntos`) y falta su equivalente en ingles, las renombra. Si conviven ambas, copia datos hacia las tablas en ingles. Tambien normaliza `starts_at` a `match_date` y `home_score_pred`/`away_score_pred` a `predicted_home_score`/`predicted_away_score`.
- `202604220002_add_external_ids_for_sync.sql`: agrega `external_id` e indices unicos para sincronizar API-Football sin duplicados. Tambien asegura campos necesarios en `matches`: `match_date`, `round`, `status`, `home_score`, `away_score`.

## Sincronizacion

El sync escribe con service role desde `POST /api/admin/sync-matches` o desde la Supabase Function `sync-matches`.

Unicidad:

- `leagues.external_id`
- `teams.external_id`
- `matches.external_id`

La UI nunca usa API-Football directamente; siempre lee datos ya persistidos en Supabase.

## Autoprofile

`handle_new_user_profile()` crea automaticamente un registro en `profiles` cuando se inserta un usuario en `auth.users`. El frontend no necesita crear perfiles manualmente durante `signUp`.

## Datos de prueba

`supabase/seed.sql` deja torneos permitidos, equipos y partidos futuros de ejemplo para probar `/prode` sin hardcodear datos en componentes.
