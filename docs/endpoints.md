# Endpoints y funciones

## Next.js route handlers

- `GET /api/prode/matches`: lista partidos cargados en Supabase para usar en el prode.
- `POST /api/prode/predictions`: guarda o actualiza una prediccion autenticada.
- `GET /api/prode/leaderboard`: devuelve el ranking desde la vista `leaderboard`.
- `GET /api/leader-events`: detalle de incidencias de jugadores.
- `GET /api/test`: prueba interna de API-Football.

## Supabase Edge Functions

- `save-prediction`: guarda o actualiza una prediccion autenticada con anon key + JWT.
- `close-predictions`: confirma el mecanismo de cierre; el bloqueo real vive en trigger y en la function de guardado.
- `sync-matches`: sincroniza fixtures desde API-Football hacia `leagues`, `teams` y `matches`.
- `sync-match-highlights`: busca videos de partidos finalizados sin `highlights_url` y guarda el resumen elegido en `matches`.
- `update-results`: actualiza finales, escribe `results` y dispara recalculo de puntos.
- `recalculate-points`: llama la RPC `recalculate_prediction_scores`.

## Regla de seguridad

Aunque el frontend bloquee visualmente, la autoridad final esta en servidor/Supabase.

Las functions `sync-matches`, `update-results` y `recalculate-points` usan `SUPABASE_SERVICE_ROLE_KEY` solamente en el runtime de Supabase Functions.

## Estado funcional

La pantalla `/prode` ya consume estos endpoints. Si Supabase no esta configurado o no hay datos en `matches`, muestra un estado vacio claro y no rompe la app.

## Servicios frontend Supabase

- `src/frontend/services/supabaseData.ts`: lectura de `leagues`, `matches`, predicciones propias y guardado de predicciones con RLS.
- `src/frontend/hooks/useAuth.ts`: recuperacion de sesion y usuario actual en cliente.
