# Migración Hay Fulbo V2 — fase 1

## Conexiones verificadas (2026-11-02 / 03 UTC)
- Nuevo Supabase: `hay-fulbo`, project ref `upehwmceyhcqrxqtdcfi`, región sa-east-1, ACTIVE_HEALTHY, organización `Hay fulbo` (Free).
- Anterior Supabase: `app-futbol`, project ref `gzqapeavjpzgmdhrizqy`, INACTIVE; no fue posible restaurarlo por bloqueo de pagos.
- GitHub: `Matilp22/golscore`, rama de migración separada `feat/hay-fulbo-v2-supabase`.
- Vercel: proyecto `golscore`, dominio hayfulbo.com; NO cambiar las variables de producción.

## Aplicado y comprobado en Supabase nuevo
1. `20261103010100_hay_fulbo_v2_preferences.sql`: 4 tablas seguras y vacías:
   - `hf_club_themes`: identidad visual y paletas publicadas por administradores.
   - `hf_user_preferences`: club principal, onboarding y modo Tribuna/Simple.
   - `hf_user_favorite_teams`: favoritos personales sincronizables entre dispositivos.
   - `hf_notification_preferences`: preferencias de alertas.
2. `20261103010200_restrict_rls_auto_enable_rpc.sql`: revoca acceso público a función interna creada por Supabase.
3. Resultado verificado: **4 tablas con RLS, 12 políticas**, y asesor de seguridad sin advertencias.
4. Avisos informativos de índices sin uso se explican porque la base aún no contiene datos ni tráfico.

## Pendiente: NO cortar la producción
- **No se copiaron las 67 migraciones antiguas**: requieren inspección secuencial y ensayos; varias contienen cambios correctivos y funciones de puntuación/administración que deben revisarse antes de aplicar.
- **No se recuperaron cuentas ni datos del Supabase anterior**: intentar exportar un respaldo, no eliminar proyecto anterior.
- Falta configurar el servidor para el nuevo proyecto: auth, RPC, datos deportivos y caché, Mi Torneito, Prode, PWA y noticias.
- **No actualizar variables de Vercel producción** hasta confirmar que las nuevas tablas y servicios cubren todos los puntos de lectura/escritura y probar una preview por rama.
- Faltan seeds legítimos de temas con IDs API-Football comprobados, verificación de identidad gráfica y autorización de uso de recursos oficiales.

## Plan de implementación por fases
1. Auditoría: inventario completo de endpoints/componentes/tablas y dependencias, baseline de rendimiento.
2. Recuperación de compatibilidad: crear funciones y tablas usadas por app existente mediante migraciones revisadas, con tests RLS.
3. Personalización: onboarding opcional, club principal, favoritos, modo Tribuna/Simple, estilos accesibles y persistencia local previa a login.
4. Cron y noticias: aprovechar PR separado de noticias (#1); integrar sólo tras verificar pipeline y claves del servidor.
5. Preview: configurar **solo** entorno branch-specific de Vercel a `upehwmceyhcqrxqtdcfi` y revisar auth, prode, partidas, favoritos, Mi Torneito, seguridad y carga móvil.
6. Corte controlado: revisar backups, mantener rollback documentado y promover sólo con aceptación explícita.

## Regla de seguridad
Nunca mezclar credenciales de la base antigua y nueva dentro de una misma preview; `SUPABASE_SERVICE_ROLE_KEY` jamás en variables `NEXT_PUBLIC_*`. No borrar ni despausar la antigua por esta migración.
