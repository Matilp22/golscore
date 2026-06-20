# Performance data pipeline - fases 1 y 2

## 1. Arquitectura anterior

Flujo esperado:

API-Football -> procesos server-side / cron / admin -> Supabase -> Next.js -> usuario.

Riesgo detectado: algunas lecturas publicas podian usar loaders legacy que, ante cache incompleto, llamaban al proveedor durante el render o durante endpoints publicos.

## 2. Arquitectura nueva

Se mantiene el flujo existente, pero se agregan dos controles:

- `requestFootballApi` tiene timeout real con `AbortController`, clasificacion de errores y tracking opcional.
- Las rutas publicas tienen read modes server-side para poder pasar de `legacy` a `cache-only` por ruta.

En `cache-only`, las rutas publicas deben leer datos almacenados en Supabase/cache y no usar API-Football como parte bloqueante del request publico.

## 3. Migracion

Archivo:

- `supabase/migrations/20260619172633_football_api_usage_daily.sql`

Estado: aplicada manualmente en Supabase. No volver a ejecutarla desde esta tarea.

Crea:

- `public.football_api_usage_daily`
- `public.record_football_api_usage(...)`

La tabla guarda contadores diarios por `endpoint` y `context`. No guarda API keys, headers, tokens, correos, cuerpos, URLs con secretos ni respuestas del proveedor.

Seguridad:

- RLS habilitado.
- Sin politicas publicas.
- `anon` y `authenticated` sin permisos.
- ejecucion de la funcion revocada a `public`, `anon` y `authenticated`.
- ejecucion permitida solo a `service_role`.

Rollback SQL documentado en la propia migracion:

```sql
drop function if exists public.record_football_api_usage(text, text, boolean, integer, text, integer);
drop table if exists public.football_api_usage_daily;
```

## 4. Feature flags

Default: `legacy`.

Variables a documentar en `.env.local.example`:

- `FOOTBALL_API_TIMEOUT_MS=8000`
- `FOOTBALL_API_USAGE_TRACKING_ENABLED=false`
- `FOOTBALL_API_DAILY_LIMIT=75000`
- `FOOTBALL_PUBLIC_READ_MODE=legacy`
- `HOME_READ_MODE=legacy`
- `LEAGUE_READ_MODE=legacy`
- `MATCH_DETAIL_READ_MODE=legacy`
- `PRODE_READ_MODE=legacy`

Global:

- `FOOTBALL_PUBLIC_READ_MODE=legacy|cache-only`

Overrides:

- `HOME_READ_MODE=legacy|cache-only`
- `LEAGUE_READ_MODE=legacy|cache-only`
- `MATCH_DETAIL_READ_MODE=legacy|cache-only`
- `PRODE_READ_MODE=legacy|cache-only`

Prioridad:

1. override de ruta
2. flag global
3. `legacy`

No usar `NEXT_PUBLIC_*` para estos flags.

Tracking de uso del proveedor:

- `FOOTBALL_API_USAGE_TRACKING_ENABLED=true`
- ausente o `false`: no registra contadores

Limite diario para estadisticas:

- `FOOTBALL_API_DAILY_LIMIT`
- default: `75000`

## 5. Endpoints de auditoria

### Uso de API-Football

`GET /api/admin/api-football-usage-stats`

Auth:

- `x-cron-secret: CRON_SECRET`
- `Authorization: Bearer CRON_SECRET`

Parametros:

- `date`
- `dateFrom`
- `dateTo`
- `days` default 7
- `groupBy`

Si la tabla no existe, devuelve `football_api_usage_daily_missing` con mensaje claro.

### Lecturas publicas

`GET /api/admin/public-read-path-audit`

Auth:

- `x-cron-secret: CRON_SECRET`
- `Authorization: Bearer CRON_SECRET`

Parametros:

- `route=home|league|match-detail|prode`
- `date`
- `fixture`
- `leagueExternalId`
- `season`

En `cache-only`, `providerCallsDuringRead` debe ser `0`.

Tambien devuelve `blockedProviderCalls`. Si es mayor a `0`, algun path intento llamar al proveedor y el guard runtime lo bloqueo antes de ejecutar `fetch`.

El parametro `mode=legacy|cache-only` puede usarse solo para auditoria admin/local sin modificar variables reales.

## 5.1 Guard runtime

Las lecturas publicas usan un guard server-side basado en `AsyncLocalStorage`.

Reglas:

- En `cache-only`, `requestFootballApi` lanza `provider_call_blocked_in_public_read` antes de ejecutar `fetch`.
- Las llamadas bloqueadas no cuentan como request real.
- Cron, admin y procesos sync no se ejecutan bajo este contexto cache-only.
- El endpoint de auditoria reporta llamadas reales y bloqueadas por separado.

## 6. Como probar

Baseline:

```bash
npm install
npm run lint
npm run typecheck
npm run build
```

Final:

```bash
npm run lint
npm run typecheck
npm run verify:public-reads
npm run build
```

Pruebas por flag individual:

```bash
HOME_READ_MODE=cache-only npm run build
LEAGUE_READ_MODE=cache-only npm run build
MATCH_DETAIL_READ_MODE=cache-only npm run build
PRODE_READ_MODE=cache-only npm run build
```

En Windows PowerShell:

```powershell
$env:HOME_READ_MODE='cache-only'; npm run build; Remove-Item Env:\HOME_READ_MODE
$env:LEAGUE_READ_MODE='cache-only'; npm run build; Remove-Item Env:\LEAGUE_READ_MODE
$env:MATCH_DETAIL_READ_MODE='cache-only'; npm run build; Remove-Item Env:\MATCH_DETAIL_READ_MODE
$env:PRODE_READ_MODE='cache-only'; npm run build; Remove-Item Env:\PRODE_READ_MODE
```

## 7. Como activar una ruta

Orden recomendado:

1. `MATCH_DETAIL_READ_MODE=cache-only`
2. `HOME_READ_MODE=cache-only`
3. `LEAGUE_READ_MODE=cache-only`
4. `PRODE_READ_MODE=cache-only`
5. `FOOTBALL_PUBLIC_READ_MODE=cache-only`

Antes de activar cada ruta, consultar:

```bash
curl -H "x-cron-secret: $CRON_SECRET" "https://<host>/api/admin/public-read-path-audit?route=match-detail&fixture=1535206"
```

Requisito:

- `providerCallsDuringRead` debe ser `0` con el flag cache-only.

## 8. Como volver a legacy

Rollback operativo:

- remover el override de ruta, o
- setear `*_READ_MODE=legacy`, o
- setear `FOOTBALL_PUBLIC_READ_MODE=legacy`

No hace falta revertir codigo para volver al comportamiento anterior.

## 9. Como consultar uso de API

```bash
curl -H "x-cron-secret: $CRON_SECRET" "https://<host>/api/admin/api-football-usage-stats?days=7"
```

Estados por uso diario:

- `< 50000`: `ok`
- `50000..64999`: `warning`
- `65000..74999`: `danger`
- `>= 75000`: `exceeded`

## 10. Riesgos conocidos

- Si `football_standings_cache` esta incompleto, `LEAGUE_READ_MODE=cache-only` puede mostrar standings vacios aunque legacy podria intentar el proveedor.
- `cache-only` no sincroniza durante render; requiere que cron/admin mantengan Supabase/cache al dia.
- El script `verify:public-reads` es un scan de texto conservador, no un parser TypeScript completo.
- Las metricas de uso son best effort: un fallo del contador no rompe la request principal.

## 11. Pendiente para fase 3

- Rankings precomputados.
- `competition_player_stats`.
- Materialized views o indices especificos de rankings.
- Separacion de cron jobs.
- Worker dedicado.
- Optimizaciones de consultas amplias luego de medir uso real.
