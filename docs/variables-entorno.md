# Variables de entorno

## Frontend publico

- `NEXT_PUBLIC_SUPABASE_URL`: URL base del proyecto Supabase, sin `/rest/v1`. Valor esperado: `https://gzqapeavjpzgmdhrizqy.supabase.co`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon key publica de Supabase. Es la unica key de Supabase que puede llegar al navegador.
- `NEXT_PUBLIC_API_URL`: URL base de la app o API interna.

Estas variables deben estar en `.env.local` en la raiz del repo, porque Next.js se ejecuta desde `C:\Users\Pili y Mati\golscore`.

Plantilla minima:

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Despues de pegar o cambiar estas claves, reiniciar `npm run dev`. Next no siempre recarga variables de entorno si el servidor ya estaba levantado.

## Server privado

- `FOOTBALL_API_KEY`: key privada de API-Football. Nunca debe ir al cliente.
- `API_FOOTBALL_KEY`: alias legacy soportado por compatibilidad local.
- `FOOTBALL_API_BASE_URL`: URL base del proveedor, por defecto `https://v3.football.api-sports.io`.
- `YOUTUBE_API_KEY`: key privada de YouTube Data API para buscar y guardar resumenes/highlights de partidos finalizados. Nunca debe ir al cliente.
- `SUPABASE_SERVICE_ROLE_KEY`: key service role para jobs y Edge Functions privadas. Nunca usar en frontend, componentes React, hooks, servicios cliente ni variables `NEXT_PUBLIC_*`.
- `ADMIN_EMAILS`: lista separada por comas de emails habilitados para entrar a `/admin`. Ejemplo: `miemail@gmail.com,otro@email.com`.
- `CRON_SECRET`: secreto para proteger cron/jobs.
- `JWT_SECRET`: reservado para integraciones server-side si se agregan tokens propios.

## Supabase Functions

- `SUPABASE_URL`: URL base del proyecto Supabase para Edge Functions, sin `/rest/v1`.
- `SUPABASE_ANON_KEY`: anon key para funciones autenticadas como `save-prediction`.
- `SUPABASE_SERVICE_ROLE_KEY`: service role solo para jobs privados como recalculo de puntos.
- `FOOTBALL_API_KEY`: key del proveedor para syncs.
- `FOOTBALL_API_BASE_URL`: URL base del proveedor.
- `CRON_SECRET`: header compartido para proteger funciones invocadas por cron.

## Archivos

- `.env.example`: plantilla versionable.
- `frontend/.env.example`: plantilla reducida de variables publicas.
- `.env.local.example`: plantilla minima para el `.env.local` real de la raiz.
- `frontend/.env.local.example`: plantilla publica de referencia para quien mire la carpeta `frontend/`.
- `.env.local`: variables locales reales. No se versiona.

Importante: si una key estuvo expuesta fuera de `.env.local`, conviene rotarla.

## Reglas de seguridad

- No usar URLs con `/rest/v1` en `createBrowserClient`, `createServerClient` o `createClient`.
- No usar `SUPABASE_SERVICE_ROLE_KEY` en ningun archivo marcado con `'use client'`.
- No exponer service role con prefijo `NEXT_PUBLIC_`.
- Los clientes del navegador deben usar solamente `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Si una tarea necesita service role, debe vivir en Supabase Functions o en codigo server-side que nunca se empaquete al cliente.
- `/admin` valida sesion con Supabase Auth y autoriza por email contra `ADMIN_EMAILS` en servidor. No usar `user_metadata` para permisos.

## Cliente unico del navegador

El cliente browser vive en `src/lib/supabase/supabaseClient.ts`, usa `createClient` de `@supabase/supabase-js` y solo lee `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

No crear otros clientes Supabase para componentes cliente.
