# Live sync crons

Hay Fulbo expone endpoints de cron protegidos por `Authorization: Bearer CRON_SECRET`.
Los crons de live sync y highlights quedan configurados en `vercel.json`. Si el proyecto corre en un plan de Vercel que no permite esas frecuencias, configurar los mismos endpoints en un proveedor externo y dejar Vercel como respaldo.

## Cron externo 1

- URL: `https://golscore.vercel.app/api/cron/sync-fixtures`
- Frecuencia: cada 15 minutos
- Header: `Authorization: Bearer CRON_SECRET`

## Cron externo 2

- URL: `https://golscore.vercel.app/api/cron/sync-live-matches`
- Frecuencia: cada 1 minuto
- Header: `Authorization: Bearer CRON_SECRET`

## Cron externo 3

- URL: `https://golscore.vercel.app/api/cron/sync-match-highlights`
- Frecuencia: cada 1 hora
- Header: `Authorization: Bearer CRON_SECRET`

## Politica de requests

- `/api/cron/sync-live-matches` pide `/fixtures?live=all` una vez por ejecucion.
- Los eventos se sincronizan cada 1 minuto solo para partidos live/relevantes.
- Las estadisticas se sincronizan cada 5 minutos para partidos en vivo.
- Las alineaciones se sincronizan desde T-180, con reintentos en T-90, T-60, T-30, inicio, post-inicio, live espaciado y final.
- Al detectar `FT`, `AET` o `PEN`, se hace sync final y un follow-up 10 minutos despues.
- `/api/cron/sync-match-highlights` revisa partidos finalizados de los ultimos 3 dias sin video. Si la busqueda principal de YouTube no encuentra un candidato confiable, intenta queries con fuentes confiables como ESPN Fans, ESPN, TNT Sports, DSports, DAZN, AFA Play, FIFA Play, FIFA+, CONMEBOL, Liga Profesional y canales oficiales. No guarda videos de canales desconocidos y descarta gameplays/simulaciones de FIFA, EA Sports FC, eFootball, PES, PS5/Xbox y similares.

El frontend solo refresca datos desde Supabase/cache. No debe consultar API-Football directamente ni disparar syncs de API-Football desde cada render.
