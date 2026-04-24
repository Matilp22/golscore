# Flujo Prode

## Convencion

La logica del prode usa nombres internos en ingles. Los textos visibles siguen en espanol.

## Lectura de datos

- Las ligas se leen desde `public.leagues`.
- Los partidos se leen desde `public.matches` por `GET /api/prode/matches`.
- El endpoint acepta filtros `leagueId`, `round`, `status` y `date`.
- El selector de torneo usa `leaguesService`.
- El selector de fecha usa `matches.round` y muestra las rondas disponibles.
- El endpoint arma `Match` en servidor con queries separadas a `leagues`, `teams` y `results`; no depende de nombres de constraints de PostgREST.

Torneos permitidos:

- Liga Profesional Argentina.
- Primera B Nacional.
- Mundial 2026.

## Sincronizacion de partidos

Los partidos reales se sincronizan desde API-Football solo del lado servidor.

La estructura runtime oficial es:

- `public.leagues`
- `public.teams`
- `public.matches`
- `public.predictions`
- `public.points`

Las tablas legacy en espanol no son fuente del runtime actual.

IDs oficiales de API-Football para el prode:

- Liga Profesional Argentina: `128`
- Primera B Nacional / Primera Nacional: `129`
- Mundial 2026: `1`

Flujo:

1. `POST /api/admin/sync-matches` selecciona todos los torneos permitidos o uno por `competition`.
2. El servicio server-side consulta `/fixtures` de API-Football con `league`, `season` y timezone `America/Argentina/Buenos_Aires`.
3. Se crea o actualiza `leagues` por `external_id`; si existe una liga legacy sin `external_id` con el mismo nombre, se normaliza.
4. Se crea o actualiza `teams` por `external_id`; si existe un equipo legacy sin `external_id` con el mismo nombre, se normaliza.
5. Se crea o actualiza `matches` con `external_id = fixture.id`. Si una base legacy exige `matches.id` numerico sin default, el sync usa `id = fixture.id` como fallback.
6. La UI del prode sigue leyendo exclusivamente desde Supabase.

El filtro de ligas permitidas se hace por `external_id` y `season`, no por nombre. Esto evita que una liga manual duplicada, por ejemplo una `Primera B Nacional` con `external_id = 131`, entre al runtime del prode.

Respuesta esperada:

- torneos procesados.
- partidos creados.
- partidos actualizados.
- partidos omitidos.
- errores por torneo, si los hubiera.

Mundial 2026 puede devolver cero fixtures si API-Football todavia no publico el calendario completo. En ese caso el sync no rompe y reporta `fetched: 0`.

Si una ejecucion previa dejo datos inconsistentes, correr primero `docs/prode-sync-cleanup.sql` desde Supabase SQL Editor. Ese script:

- asegura las tres ligas canonicas;
- borra partidos fuera de alcance si no tienen predicciones;
- borra ligas duplicadas sin partidos;
- borra equipos huerfanos que el sync real puede recrear desde fixtures oficiales.

## Predicciones

1. El usuario inicia sesion con Supabase Auth.
2. El frontend carga la sesion con `useAuth`.
3. El formulario llama `POST /api/prode/predictions`.
4. El endpoint obtiene el usuario con Supabase Auth en servidor.
5. El servicio valida que exista el partido y que no este bloqueado.
6. Se guarda una unica prediccion por `user_id + match_id`.

Contrato interno:

- Request: `matchId`, `predictedHomeScore`, `predictedAwayScore`.
- Base: `match_id`, `predicted_home_score`, `predicted_away_score`.
- UI: muestra textos como Guardar, Actualizar, Bloqueado y Mis predicciones.

## Bloqueo

La regla es: no se puede editar cuando faltan 15 minutos o menos para el inicio del partido.

La regla vive en:

- `src/frontend/types/prode.ts`
- `src/server/prode/rules.ts`
- `src/server/prode/service.ts`
- trigger SQL `prevent_locked_prediction()`
- Supabase Function `save-prediction`

## Puntos

Reglas:

- Exacto: 3 puntos.
- Resultado correcto sin exactitud: 1 punto.
- Incorrecto: 0 puntos.

El calculo vive en:

- `src/server/prode/rules.ts` para codigo server-side Next.
- RPC `public.recalculate_prediction_scores()` para Supabase.
- Function `recalculate-points` para correr jobs.

## Ranking

El ranking se lee desde la vista `leaderboard`, respaldada por `leaderboards`.

La pantalla usa `src/frontend/services/leaderboardService.ts` y renderiza `LeaderboardTable`.

## Errores

Los endpoints distinguen:

- Supabase no configurado.
- Usuario no autenticado.
- Tabla o columna faltante por migraciones pendientes.
- Tabla vacia o sin ligas permitidas.
- Fallo de API externa en Edge Functions.
- Fallo de API externa en el endpoint server-side de sync.

## Datos de prueba

`supabase/seed.sql` crea torneos permitidos y partidos futuros con `match_date` para probar predicciones.
