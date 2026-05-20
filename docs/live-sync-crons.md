# Live sync crons

Hay Fulbo no ejecuta crons por minuto desde `vercel.json` porque Vercel Hobby solo permite crons diarios. El cron diario de Vercel queda como respaldo, y la frecuencia alta se configura en un proveedor externo.

## Cron externo 1

- URL: `https://golscore.vercel.app/api/cron/sync-fixtures`
- Frecuencia: cada 15 minutos
- Header: `Authorization: Bearer CRON_SECRET`

## Cron externo 2

- URL: `https://golscore.vercel.app/api/cron/sync-live-matches`
- Frecuencia: cada 1 minuto
- Header: `Authorization: Bearer CRON_SECRET`

## Politica de requests

- `/api/cron/sync-live-matches` pide `/fixtures?live=all` una vez por ejecucion.
- Los eventos se sincronizan cada 1 minuto solo para partidos live/relevantes.
- Las estadisticas se sincronizan cada 5 minutos para partidos en vivo.
- Las alineaciones se sincronizan en ventanas T-90, T-60, T-30, inicio, live espaciado y final.
- Al detectar `FT`, `AET` o `PEN`, se hace sync final y un follow-up 10 minutos despues.

El frontend solo refresca datos desde Supabase/cache. No debe consultar API-Football directamente ni disparar syncs de API-Football desde cada render.
