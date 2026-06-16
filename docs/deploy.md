# Deploy

## Local

```bash
npm install
npm run lint
npm run typecheck
npm run build
npm run dev
```

El proyecto Next.js se ejecuta desde la raiz del repositorio. La capa visual vive en `src/frontend`, no en un paquete separado.

Variables minimas para desarrollo:

```env
FOOTBALL_API_KEY=
FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
YOUTUBE_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Para este proyecto, la URL publica correcta de Supabase es:

```env
NEXT_PUBLIC_SUPABASE_URL=https://gzqapeavjpzgmdhrizqy.supabase.co
```

No agregar `/rest/v1` a esa URL.

## Vercel

El frontend/server-side Next.js esta preparado para Vercel desde la raiz del repo.

Configurar estas variables en Vercel:

- `FOOTBALL_API_KEY`
- `FOOTBALL_API_BASE_URL`
- `YOUTUBE_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`

`API_FOOTBALL_KEY` sigue soportado como alias legacy, pero para deploy nuevo usar `FOOTBALL_API_KEY`.

## Supabase

Aplicar migraciones desde `supabase/migrations`.

```bash
supabase db push
```

La migracion `202604220001_normalize_prode_english.sql` es no destructiva y deja el modelo final en ingles. Si una instalacion previa tenia tablas en espanol, las renombra o copia datos hacia `profiles`, `leagues`, `teams`, `matches`, `predictions` y `points`.

La migracion `202604220002_add_external_ids_for_sync.sql` agrega soporte no destructivo para sincronizacion: `external_id` en `leagues`, `teams` y `matches`, `season` en `leagues`, y los campos de partido usados por el prode. Tambien crea indices unicos para evitar duplicados por ID externo.

Si la base ya tuvo cargas manuales o un sync fallido, revisar y ejecutar el plan de limpieza en `docs/prode-sync-cleanup.sql` antes de reintentar el sync real.

Funciones previstas:

```bash
supabase functions deploy save-prediction
supabase functions deploy close-predictions
supabase functions deploy sync-matches
supabase functions deploy update-results
supabase functions deploy recalculate-points
```

Configurar secrets de functions:

```bash
supabase secrets set SUPABASE_URL=https://gzqapeavjpzgmdhrizqy.supabase.co
supabase secrets set SUPABASE_ANON_KEY=...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set FOOTBALL_API_KEY=...
supabase secrets set FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
supabase secrets set CRON_SECRET=...
```

## Sync manual de partidos

El endpoint server-side para sincronizar partidos reales es:

```bash
http://localhost:3000/api/admin/sync-matches
```

En desarrollo local (`NODE_ENV !== 'production'`) se puede abrir esa URL directamente desde el navegador sin enviar `x-cron-secret`.

Tambien se puede ejecutar por consola:

```bash
curl -X POST http://localhost:3000/api/admin/sync-matches
```

Para un torneo especifico:

```bash
http://localhost:3000/api/admin/sync-matches?competition=liga-profesional-argentina
curl -X POST "http://localhost:3000/api/admin/sync-matches?competition=liga-profesional-argentina"
curl -X POST "http://localhost:3000/api/admin/sync-matches?competition=primera-b-nacional"
curl -X POST "http://localhost:3000/api/admin/sync-matches?competition=mundial-2026"
```

El sync solo procesa las ligas oficiales `128`, `129` y `1` de API-Football y escribe en `leagues`, `teams` y `matches`.

En produccion, configurar siempre `CRON_SECRET` y enviar el header:

```bash
x-cron-secret: <valor>
```

Si `CRON_SECRET` no esta configurado en produccion, el endpoint rechaza la ejecucion con `401`.

El endpoint usa `FOOTBALL_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY` solo en servidor. El frontend nunca llama a API-Football.

Tambien existe la Supabase Function `sync-matches`, con el mismo parametro `competition`, para cron o ejecucion programada.

## Sync de highlights

El endpoint server-side para buscar resumenes de partidos finalizados es:

```bash
http://localhost:3000/api/cron/sync-match-highlights
```

En produccion se invoca con:

```bash
Authorization: Bearer <CRON_SECRET>
```

Necesita `YOUTUBE_API_KEY` en servidor. Revisa partidos finalizados sin `highlights_url`, busca en YouTube y guarda la URL seleccionada en `public.matches`. Prioriza busquedas en espanol y fuentes como TyC Sports, Telefe, ESPN Fans, ESPN, TNT Sports, DSports, DAZN, AFA Play, FIFA Play, FIFA+, CONMEBOL, Liga Profesional y canales oficiales. Solo acepta canales confiables/oficiales y descarta gameplays o simulaciones de FIFA, EA Sports FC, eFootball, PES, PS5/Xbox y similares. En `vercel.json` esta programado cada 4 horas (`0 */4 * * *`) con limite bajo para no consumir la cuota diaria de YouTube de golpe.

## Chequeos posteriores

- Abrir `/` y verificar partidos.
- Abrir `/login` y probar registro/login cuando Supabase Auth este configurado.
- Abrir `/prode` y verificar que lista torneos permitidos, fechas y partidos desde `public.leagues` y `public.matches`.
- Probar `GET /api/prode/leaderboard`.
- Probar `POST /api/admin/sync-matches` y luego abrir `/prode`.
- Probar `POST /api/prode/predictions` con un usuario autenticado y un `match_id` existente en Supabase.
- Desde el navegador, probar los servicios en `src/frontend/services/supabaseData.ts` para leer `leagues`, `matches`, `predictions` propias y guardar una prediccion autenticada con `predicted_home_score` y `predicted_away_score`.

Para cargar datos de prueba:

```bash
supabase db reset
```

o ejecutar manualmente `supabase/seed.sql` en el SQL editor.

## Pendientes manuales para primer deploy real

- Crear o seleccionar proyecto Supabase.
- Cargar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local` y Vercel.
- Ejecutar migraciones.
- Cargar/sincronizar datos iniciales en `teams`, `leagues` y `matches`.
- Configurar Auth en Supabase con los redirect URLs del dominio de Vercel.
- Configurar cron externo o Supabase Scheduled Functions para `sync-matches`, `update-results` y `recalculate-points`.
