# Hay Fulbo V2 — migración real y estado de implementación

## Estado verificado (2026-11-03 UTC)

**Base nueva:** Supabase `hay-fulbo` (`upehwmceyhcqrxqtdcfi`), São Paulo, ACTIVE_HEALTHY.

**Infraestructura de datos:** 54 tablas en `public`, **54 con RLS habilitado**, 71 migraciones aplicadas (incluyen las de esquema V2, compatibilidad y noticias). Estas 71 no equivalen a 71 de las 67 migraciones históricas: varias migraciones originales incompatibles con la estructura `BIGINT` fueron reemplazadas por archivos en `supabase/compat/`.

**Seguridad:** auditor de seguridad sin WARN ni ERROR. Hay advertencias `INFO` para tablas RLS internas con cero políticas porque sólo se accede desde service role, nunca desde el cliente. Se reparó la función pública de recálculo de puntos a `BIGINT`, se revocó la ejecución de funciones privilegiadas y se limitaron accesos de las tablas.

**Compatibilidad restaurada (estructura sin datos de usuario):** partidos, equipos, competiciones, posiciones/cachés, datos de partidos, jugadores, campeones, clasificaciones, Prode, ligas favoritas, torneos privados, Mi Torneito, panel admin, configuración PWA push, registro de cuota de API-Football y bot de noticias.

**Identidad V2:** temas de club, equipo principal persistente por usuario, modo Tribuna/Simple, favoritos por usuario y preferencias de notificaciones.

**GitHub:** rama `feat/hay-fulbo-v2-supabase`; PR de revisión, no fusionado.

**Vercel:** proyecto `golscore` vinculado a hayfulbo.com. La rama V2 tiene variables propias de preview:
- `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_URL`: URL nueva.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: clave publicable nueva.
- `SUPABASE_SERVICE_ROLE_KEY`: valor inválido de bloqueo intencional (**debe reemplazarse por el secreto del proyecto V2, nunca el anterior**).

Esto evita mezclar las claves secretas del proyecto suspendido con las nuevas URLs. Hasta reemplazar ese valor, **las rutas server-side de administración/sincronización que requieran service role fallarán de forma segura en la preview**.

## Bloqueos y verificaciones pendientes

1. **No se recuperaron los datos antiguos**: usuarios, favoritos antiguos, predicciones, torneos, etc. siguen bloqueados en `app-futbol`. No borrar ese proyecto. Intentar respaldo/exportación y luego reconciliación de IDs.
2. **Nueva clave secreta para la preview:** sustituir `SUPABASE_SERVICE_ROLE_KEY` de la rama V2 por el secreto correspondiente a `upehwmceyhcqrxqtdcfi`, directamente en el panel Vercel; no enviarlo por chat, no añadirlo al repositorio.
3. **Autenticación:** configurar Site URL y redirecciones de Supabase Auth para la URL de preview y el dominio final, cuando se valide el corte.
4. **Funciones Edge y Storage:** revisar `supabase/functions`, buckets, configuraciones y secrets; las migraciones de tablas no restauran objetos almacenados ni funciones desplegadas.
5. **Rendimiento:** revisar 25 índices FK ausentes, 4 duplicados y 8 políticas permisivas múltiples identificadas por el asesor, con pruebas de regresión. Los índices marcados como «unused» todavía no reflejan tráfico real.
6. **Cron/automatización:** Vercel conectado está limitado por configuración Hobby; noticiero corre sólo si se habilita flag y se provee clave IA opcional. No activado.
7. **Preview funcional:** comprobar navegadores móvil y escritorio, rutas de partidos, Prode (predicciones/score), Mi Torneito, sesión, favoritos, noticias y alertas antes de fusionar.
8. **No tocar producción:** las variables globales actuales siguen apuntando al Supabase suspendido. Hacer corte sólo tras pasar validaciones, respaldo, monitoreo y plan de rollback.
9. **Historial de migraciones:** las migraciones legacy se aplicaron con nombres `legacy_...` y orden SQL, mientras que las correcciones de compatibilidad quedaron en `supabase/compat/`. Antes de usar `supabase db push` en otra instancia debe consolidarse baseline limpio / reconciliar el historial. No ejecutar todos los SQL antiguos tal cual; varios fallan por UUID/BIGINT.

## Consideraciones del producto
No está construida aún la interfaz final de personalización ni rediseñado Inicio/Mi Club. Las tablas V2 son infraestructura para esas interfaces. La sección de noticias automáticas tiene PR aparte; el esquema está listo, no hay publicación en funcionamiento.

## Garantías
No hay cambios en `main` ni en el dominio público como consecuencia de estas migraciones. No se modificaron Nutrición Merli ni Brava Créditos.
