# Mi Torneito

Mi Torneito es el MVP concierge para crear torneos amateur dentro de Hay Fulbo.

## Rutas

- Publica: `/mi-torneito`
- Solicitud: `/mi-torneito/solicitar`
- Listado publico: `/mi-torneito/torneos`
- Torneo publico: `/mi-torneito/t/:tournamentSlug`
- Equipo publico: `/mi-torneito/t/:tournamentSlug/e/:teamSlug`
- Partido publico: `/mi-torneito/t/:tournamentSlug/p/:matchId`
- Panel superadmin: `/admin/mi-torneito`
- Panel organizador: `/mi-torneito/admin`

## Superadmin

El superadmin sigue el patron existente del repo:

1. Crear usuario en Supabase Auth.
2. Agregar su email a `ADMIN_EMAILS`, separado por coma si hay mas de uno.
3. Entrar por `/admin/login`.
4. Administrar Mi Torneito desde `/admin/mi-torneito`.

## Flujo MVP

1. Un organizador envia una solicitud publica.
2. El superadmin revisa `/admin/mi-torneito/solicitudes`.
3. El superadmin crea organizacion + torneo desde `/admin/mi-torneito/torneos`.
4. El superadmin asigna un email administrador del torneo.
5. El organizador entra a `/mi-torneito/admin` y carga equipos, rondas, partidos y resultados.
6. La pagina publica calcula la tabla desde partidos finalizados.

## Base de datos

Las tablas estan namespaced para no mezclarse con API-Football:

- `mi_torneito_organizations`
- `mi_torneito_tournament_requests`
- `mi_torneito_tournaments`
- `mi_torneito_teams`
- `mi_torneito_rounds`
- `mi_torneito_matches`
- `mi_torneito_tournament_admins`
- `mi_torneito_audit_logs`

## Seed de desarrollo

Hay un seed opcional en `supabase/seed.mi_torneito_demo.sql`.
No se ejecuta solo. Usarlo solo en local/desarrollo luego de aplicar la migracion.

## Pendiente fuera del MVP

- Pagos.
- Push notifications.
- Chat/comentarios.
- Estadisticas individuales avanzadas.
- Invitaciones por email automáticas.
