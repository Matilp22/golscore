# Notificaciones PWA

La app queda preparada para registrar suscripciones Web Push cuando corre instalada como PWA.

## Comportamiento

- No pide permisos en la web normal.
- Solo muestra el opt-in en modo instalado (`display-mode: standalone`).
- Requiere `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- Guarda la suscripcion en `/api/pwa/push-subscriptions`.
- Si Supabase o la tabla no estan disponibles, el endpoint responde 503 y la UI muestra error.
- No se agregaron crons, jobs ni envio automatico de pushes.

## Base de datos

La migracion local es:

- `supabase/migrations/20260702000100_pwa_push_subscriptions.sql`

Hace:

- `create table if not exists public.pwa_push_subscriptions`
- indices por `user_id` y `device_id`
- RLS habilitado
- policies para usuarios autenticados sobre sus propias suscripciones
- trigger `updated_at`

No hace `drop table`, `delete` ni `truncate`.

## Pendiente para envio real

Para enviar notificaciones reales falta implementar un emisor server-side con clave VAPID privada y reglas de negocio. Esa clave no debe exponerse en frontend.
