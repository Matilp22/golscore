# Motor de noticias automáticas postpartido
Rama independiente; sin cambios en producción hasta aprobar el PR.

## Estado
- Las rutas y el cron están desarrollados.
- La base Supabase conectada estaba INACTIVA al 2026-11-02 y su restauración fue rechazada por facturas impagas. La migración NO está aplicada.
- Al no disponer de base activa ni clave OPENAI_API_KEY en Vercel, NO está funcionando la publicación automática.
- Activación controlada por HF_MATCH_NEWS_ENABLED=true y publicación por HF_MATCH_NEWS_AUTO_PUBLISH=true. Sin activar, el cron responde enabled=false.

## Integración
1. Resolver la factura y restaurar Supabase (mismo proyecto y credenciales).
2. Aplicar supabase/migrations/20261102152000_hf_match_news.sql. Verificar RLS y RPC.
3. Cargar OPENAI_API_KEY **solo** en entornos servidor de Vercel (opcional; sin clave usa plantilla factual, no inventa jugadas).
4. Configurar HF_MATCH_NEWS_ENABLED=true, HF_MATCH_NEWS_AUTO_PUBLISH=false para empezar con borradores; luego true tras validar.
5. Opcional HF_MATCH_NEWS_LEAGUES=128,130,13,11,2,1. Adaptar a competiciones seleccionadas y cuota API.
6. CRON_SECRET y FOOTBALL_API_KEY ya figuran como variables en Vercel; nunca mostrar secretos.
7. En este Vercel se detectó plan Hobby: el cron GET /api/cron/match-news corre **una vez por día** (08:15 UTC) por restricción del plan, no cada cinco minutos. Para postpartido inmediato es necesario cambiar a Vercel Pro y restaurar `*/5 * * * *` o usar un planificador externo autorizado. Tiene espera de cuatro minutos después de ver un final; procesa hasta dos artículos por pasada. Evita duplicados por fixture_id.
8. Notas publicadas aparecen en /noticias y /noticias/partido/[id], dentro del diseño original. Borradores se administran en Supabase hasta que se construya el panel definitivo.
9. Validar typecheck, build y preview de Vercel antes de fusionar la rama.
