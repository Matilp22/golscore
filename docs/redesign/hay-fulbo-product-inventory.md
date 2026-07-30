# Hay Fulbo: inventario integral previo al rediseño

Estado del documento: completo para Etapa 0  
Fecha de corte: 2026-07-29 (America/Buenos_Aires)  
Rama de auditoría: `codex/hay-fulbo-redesign-complete-preview`  
Base inmutable: `origin/main` en `5695513c3566bc90f674c9f951d38cf898601fb5`

## 1. Estado inicial del repositorio y aislamiento

La auditoría comenzó en `prueba/diseno-prode-hay-fulbo`, commit
`8fb34bb0fb146219a8218c0c23f0b1162e93b6cb`. Esa rama estaba tres commits por
delante de `origin/main` y contenía 148 archivos con cambios sin confirmar
(41.586 inserciones y 1.401 eliminaciones), incluidos archivos rastreados,
archivos nuevos, pruebas, assets, migraciones y restos de ejecución.

Nada fue descartado. El árbol completo se preservó en el stash
`01c4b61475a94163c2229239c9dbc112e4b84db5`, con el mensaje:

`safety/pre-hay-fulbo-redesign-2026-07-29 from prueba/diseno-prode-hay-fulbo`

La rama de rediseño fue creada directamente desde `origin/main`; su commit
inicial, `main` y `origin/main` eran el mismo SHA. No se hizo merge, rebase,
cherry-pick, reset, limpieza destructiva ni cambio remoto.

### Línea de base ejecutable

- `npm install`: correcto; no modificó `package-lock.json`. NPM informó 14
  vulnerabilidades transitivas (1 baja, 6 moderadas y 7 altas), todavía no
  auditadas ni corregidas para evitar upgrades fuera de alcance.
- `npm run lint`: correcto.
- `npm run typecheck`: correcto después de eliminar solamente `.next`,
  generado localmente y con tipos obsoletos de la rama previa.
- `npm run build`: correcto; generó 82 páginas estáticas.
- Datos reales: home, fechas, partido, tabla, equipo y jugador devolvieron
  datos desde el pipeline actual.

## 2. Tamaño y estructura real

| Área | Archivos | Responsabilidad observada |
| --- | ---: | --- |
| `src/app` | 206 | App Router, metadata, páginas y handlers |
| `src/frontend` | 101 | shell, navegación, vistas y estado cliente |
| `src/server` | 59 | proveedor, caché, Supabase y reglas |
| `src/shared` | 47 | configuración, tipos y utilidades |
| `src/lib` | 12 | fachadas de datos y clientes |
| `src/components` | 8 | componentes compartidos adicionales |
| `src/content` | 5 | noticias y mercado local |

Hay 57 `page.tsx`, 131 `route.ts`, 4 layouts y 5 loadings. Existe
`global-error.tsx`, pero no existen `error.tsx` segmentados ni una
`not-found.tsx` propia.

## 3. Mapa completo de páginas

Los grupos de ruta de Next.js no forman parte de la URL. Las rutas marcadas
como protegidas requieren sesión y/o pertenencia administrativa.

### Sitio público, legal y editorial

- `/`
- `/analisis`
- `/analisis/[slug]`
- `/competiciones`
- `/contacto`
- `/cookies`
- `/equipo/[id]`
- `/equipos`
- `/estadisticas`
- `/fuentes-y-metodologia`
- `/jugador/[id]`
- `/liga/[id]`
- `/liga/[id]/campeones`
- `/mercado-de-pases`
- `/mercado-de-pases/[slug]`
- `/noticias`
- `/noticias/[slug]`
- `/partido/[id]`
- `/partido/[id]/historial`
- `/politica-editorial`
- `/privacidad`
- `/quienes-somos`
- `/seccion/[id]`
- `/tablas`
- `/terminos`

### Alias y redirecciones heredadas

- `/contact` redirige a `/contacto`.
- `/privacy-policy` redirige a `/privacidad`.
- `/terms` redirige a `/terminos`.

Las URLs públicas existentes son invariantes del rediseño. Cualquier cambio
futuro exigiría una redirección explícita y una decisión SEO documentada.

### Autenticación y cuenta

- `/login`
- `/register`
- `/restablecer-contrasena`
- `/perfil`
- `/auth/callback` (route handler OAuth/correo)

### Prode

- `/prode`
- `/prode/torneos`
- `/prode/torneos/[id]`
- `/prode/torneos/invitacion/[token]`

### Mi Torneito

- `/mi-torneito`
- `/mi-torneito/admin` (requiere sesión y permisos asignados)
- `/mi-torneito/solicitar`
- `/mi-torneito/torneos`
- `/mi-torneito/t/[tournamentSlug]`
- `/mi-torneito/t/[tournamentSlug]/e/[teamSlug]`
- `/mi-torneito/t/[tournamentSlug]/p/[matchId]`

### Administración

- `/admin/login`
- `/admin`
- `/admin/ads`
- `/admin/broadcasts`
- `/admin/featured-matches`
- `/admin/matches`
- `/admin/mi-torneito`
- `/admin/mi-torneito/solicitudes`
- `/admin/mi-torneito/torneos`
- `/admin/mi-torneito/torneos/[tournamentId]`
- `/admin/sync`
- `/admin/visibility`

El layout protegido valida Supabase Auth y `ADMIN_EMAILS`; una sesión común no
otorga acceso administrativo.

### Rutas técnicas visibles

- `/sentry-example-page`
- `/sentry-test`

Estas rutas deben revisarse antes del preview final: hoy forman parte del
build público aunque su propósito es diagnóstico.

## 4. Route handlers y endpoints

### Públicos o consumidos por la interfaz

| Endpoint | Métodos | Función |
| --- | --- | --- |
| `/api/global-actions-data` | GET | búsqueda, partidos, equipos, eventos y notificaciones |
| `/api/home/live-events` | GET | incidencias recientes de home |
| `/api/home/live-sync` | GET | actualización de partidos en vivo |
| `/api/leader-events` | GET | actualización de líderes |
| `/api/match-detail/live-sync` | GET | actualización del detalle |
| `/api/share-card-asset` | GET | asset para compartir |
| `/api/pwa/push-subscriptions` | POST, DELETE | alta/baja de push |
| `/api/prode/leaderboard` | GET | clasificación del Prode |
| `/api/prode/matches` | GET | partidos habilitados |
| `/api/prode/my-predictions` | GET | pronósticos autenticados |
| `/api/prode/predictions` | POST | guarda pronósticos |
| `/api/prode/world-cup-groups` | GET | grupos del Mundial para Prode |
| `/api/prode/private-tournaments` | GET, POST | listado y creación |
| `/api/prode/private-tournaments/search` | GET | búsqueda de privados |
| `/api/prode/private-tournaments/[id]` | GET | detalle privado |
| `/api/prode/private-tournaments/[id]/chat` | GET | estado del chat |
| `/api/prode/private-tournaments/[id]/chat/messages` | POST | publica mensaje |
| `/api/prode/private-tournaments/[id]/chat/messages/[messageId]` | DELETE | elimina mensaje |
| `/api/prode/private-tournaments/[id]/invites` | POST | crea invitación |
| `/api/prode/private-tournaments/[id]/request-access` | POST | solicita acceso |
| `/api/prode/private-tournaments/[id]/requests/[requestId]/approve` | POST | aprueba acceso |
| `/api/prode/private-tournaments/[id]/requests/[requestId]/reject` | POST | rechaza acceso |
| `/api/prode/private-tournament-invites/[token]` | GET | lee invitación |
| `/api/prode/private-tournament-invites/[token]/accept` | POST | acepta invitación |
| `/api/prode/private-tournament-invites/[token]/revoke` | POST | revoca invitación |
| `/.well-known/apple-app-site-association` | GET | asociación iOS |
| `/.well-known/assetlinks.json` | GET | asociación Android |

También existen `/api/test` y `/api/sentry-example-api`. Deben conservar su
contrato durante la implementación y evaluarse para exclusión pública antes
del cierre.

### Crons

- `/api/cron/sync-fixtures` (GET, POST; Vercel diario 08:00 UTC)
- `/api/cron/sync-live-matches` (GET, POST; Vercel diario 08:05 UTC)
- `/api/cron/sync-match-highlights` (GET, POST; Vercel diario 08:10 UTC)

Aceptan `CRON_SECRET`/`ADMIN_CRON_SECRET` según el handler. El rediseño no
debe cambiar horarios, autenticación, carga ni consumo de proveedor.

### API administrativa

La API administrativa se organiza en cinco familias. La lista es exhaustiva
para el corte auditado:

1. Datos y página: `api-football-usage-audit`,
   `api-football-usage-stats`, `assets-audit`, `assets-render-audit`,
   `champion-logo-cleanup-audit`, `champions-history-audit`,
   `competition-data-audit`, `competition-incidents-rankings-audit`,
   `competition-page-audit`, `competition-rules-audit`,
   `competitions-audit`, `conmebol-bracket-audit`,
   `conmebol-raw-rounds-audit`, `copa-argentina-audit`,
   `country-names-audit`, `data-audit`, `event-stats-audit`,
   `full-competition-audit`, `head-to-head-audit`,
   `highlight-render-audit`, `highlights-audit`, `home-date-audit`,
   `home-full-audit`, `home-incidents-audit`, `home-matches-audit`,
   `home-matches-diagnostics`, `home-scorers-audit`,
   `home-time-status-audit`, `incidents-audit`, `league-phases-audit`,
   `liga-profesional-audit`, `liga-profesional-promedios-audit`,
   `live-sync-audit`, `match-detail-audit`, `match-detail-render-audit`,
   `match-details-audit`, `match-details-league-audit`,
   `match-detail-state-audit`, `match-detail-system-audit`,
   `match-events-audit`, `match-events-diagnostics`,
   `match-info-audit`, `match-statistics-audit`, `match-status-audit`,
   `match-sync-diagnostics`, `missing-match-info-audit`,
   `provider-broadcasts-audit`, `public-read-path-audit`,
   `scorer-rules-audit`, `share-card-audit`,
   `team-logo-identity-audit`, `text-encoding-audit`,
   `uefa-rounds-audit`, `world-cup-champions-audit` y
   `world-cup-head-to-head-audit`.
2. Prode y privados: `private-tournament-chat-audit`,
   `private-tournament-invites-audit`, `prode-audit`,
   `prode-diagnostics`, `prode-lock-audit`, `prode-points-debug`,
   `prode-world-cup-audit` y `recalculate-points`.
3. TV y contenidos destacados: `approve-broadcast-rule-suggestion`,
   `broadcast-rules-audit`, `broadcast-rule-suggestions`, `broadcasts`,
   `broadcasts-diagnostics`, `cleanup-broadcast-defaults`,
   `seed-broadcast-rules`, `sync-broadcasts`,
   `sync-provider-broadcasts` y `verify-broadcast-rule`.
4. Sincronización: `competition-head-to-head`,
   `generate-liga-profesional-playoffs`, `sync-assets`,
   `sync-competition-full`, `sync-competition-incidents`,
   `sync-conmebol-knockouts`, `sync-conmebol-standings`,
   `sync-head-to-head`, `sync-home-matches`, `sync-league-events`,
   `sync-leagues`, `sync-liga-profesional-promedios`, `sync-match`,
   `sync-match-detail`, `sync-match-details`, `sync-matches`,
   `sync-match-events`, `sync-match-highlights` y
   `sync-upcoming-match-info`.
5. Escritura y reparación: `dedupe-match-events`, `fix-text-encoding`,
   `upsert-conmebol-draw`, `upsert-tournament-champions` y
   `upsert-world-cup-finals`.

Riesgo: algunos handlers administrativos mutantes admiten GET además de POST.
No se invocarán durante QA; un crawler, prefetch o verificación automática
jamás debe recorrerlos de forma indiscriminada.

## 5. Inventario funcional

| Módulo | Capacidades existentes | Observación |
| --- | --- | --- |
| Home | cambio de fecha, hoy/ayer/mañana, en vivo, próximos, finalizados, goleadores, TV, favoritos, noticias | datos reales y caché; foco principal del producto |
| Partidos | estado, minuto, agregado, marcador, penales, global, estadio, árbitro, TV, share, historial | detalle combina caché y enriquecimiento |
| Cronología | goles, tarjetas, cambios y eventos API-Football normalizados | algunos tipos dependen del texto del proveedor |
| Estadísticas | valores absolutos y porcentajes por equipo | un valor nulo se renderiza vacío en la línea base |
| Formaciones | once, posiciones, dorsales, suplentes, técnicos | mobile 390 px presenta superposición; jugadores no enlazados |
| Competencias | fixture, tabla, grupos, playoff, promedios, líderes, campeones | muchas variantes y reglas especiales |
| Mundial 2026 | portada, grupos, fixture, llaves, simulador, líderes, selecciones, noticias e historia | cuatro assets del carrusel devuelven 400 |
| Equipos/selecciones | identidad, estadio, plantel, próximos/anteriores, competencias, noticias, extras locales | Boca carga plantel pero “Competiciones” queda vacía |
| Jugadores | perfil, club/selección, estadísticas y partidos relacionados | funciona con fallback y query contextual |
| Noticias | portada, artículo, relacionados y SEO | fuente editorial local, no CMS |
| Mercado de pases | listado y artículo | fuente local |
| Análisis | listado y Markdown | archivos locales de contenido |
| Búsqueda | modal, autofoco, cierre, debounce, estados y grupos | solo equipos, competencias, partidos y páginas |
| Favoritos | agregar/quitar, persistencia local y listado global | hidratación inconsistente si localStorage tiene datos |
| Recordatorios | activar/quitar por partido y persistencia local | alimenta notificaciones |
| Notificaciones | eventos en vivo, recordatorios y favoritos; leído/limpiar | agregador cliente honesto, no simula push |
| PWA/push | instalación, opt-in y suscripción | depende de permisos, VAPID y service worker |
| Auth | login, alta, recuperación, persistencia, logout y perfil | Supabase SSR + cliente |
| Prode | pronósticos, bloqueo, puntaje, ranking, grupos y privados con invitaciones/chat | UI visualmente separada del shell global |
| Mi Torneito | solicitudes, torneos, fixture, tabla, equipos, partido y panel organizador | repositorio Supabase real; portada contiene una demo falsa |
| Administración | visibilidad, partidos, TV, ads, destacados, sync y Mi Torneito | alto riesgo de regresión y permisos |
| Ads | script, slots y configuración administrativa | debe reservar espacio para evitar CLS |
| Analítica | GA, Vercel Analytics y Sentry | scripts condicionales por entorno |
| SEO | metadata, canonical, Open Graph, Twitter, sitemap, robots y JSON-LD por páginas | URLs públicas deben permanecer |
| Asociaciones app | manifest, Apple AASA y Android asset links | no es UI, pero sí contrato desplegado |

## 6. Mapa de datos

### Flujo general

`API-Football -> sincronización/normalización servidor -> Supabase/caché -> Server Components/route handlers -> componentes cliente`

Las lecturas públicas de home, liga, partido y Prode pueden operar en modo
`cache-only`. Un `AsyncLocalStorage` audita e impide llamadas al proveedor
cuando la lectura pública fue configurada para no consumir cuota.

### API-Football

Endpoints observados:

- `/fixtures`: fixture, resultado, estado, minuto, equipos, liga, estadio y TV
  derivada.
- `/fixtures/events`: goles, tarjetas, cambios, VAR y otras incidencias.
- `/fixtures/statistics`: métricas por equipo.
- `/fixtures/lineups`: formaciones, once, suplentes y entrenadores.
- `/fixtures/headtohead`: historial entre equipos.
- `/standings`: tablas, grupos y clasificación.
- `/teams`: identidad y sede.
- `/players/squads`: planteles.
- `/players`: ficha y estadísticas de jugador.

Toda llamada se hace en servidor con `x-apisports-key`, timeout, backoff de 30
minutos para rate limit y registro agregado de uso. La clave no llega al
cliente.

### Supabase

Tablas referenciadas por el código:

- Fútbol/caché: `leagues`, `teams`, `players`, `matches`, `match_events`,
  `match_broadcasts`, `football_fixture_cache`,
  `football_match_detail_cache`, `football_standings_cache`,
  `match_head_to_head_cache`, `football_api_usage_daily`.
- Reglas/editorial deportivo: `admin_ad_slots`,
  `admin_broadcast_overrides`, `admin_featured_matches`,
  `admin_match_detail_overrides`, `admin_visibility_rules`,
  `broadcast_rules`, `broadcast_rule_suggestions`,
  `team_identity_overrides`, `conmebol_bracket_series`,
  `copa_argentina_champions`, `tournament_champions`,
  `world_cup_finals`.
- Auth/Prode: `profiles`, `predictions`, `prediction_scores`, `results`,
  `points`, `leaderboards`, `prode_private_tournaments`,
  `prode_private_tournament_members`,
  `prode_private_tournament_join_requests`,
  `private_tournament_invites`, `private_tournament_chats`,
  `private_tournament_chat_messages`.
- Mi Torneito: `mi_torneito_organizations`, `mi_torneito_tournaments`,
  `mi_torneito_tournament_requests`, `mi_torneito_tournament_admins`,
  `mi_torneito_rounds`, `mi_torneito_matches`, `mi_torneito_teams`,
  `mi_torneito_audit_logs`.
- PWA: `pwa_push_subscriptions`.

RPC observadas: `recalculate_prediction_scores` y
`record_football_api_usage`.

El cliente admin con service role es `server-only`. El rediseño no requiere
ni autoriza esquema, migraciones, RLS, funciones, triggers, grants o datos
remotos.

### Datos locales

- `src/content/editorial`: noticias, transferencias, contenidos del Mundial y
  tipos.
- `content/analisis`: cinco guías Markdown.
- `src/shared/config` y configuración de torneos: identidad, temporadas,
  formatos y reglas de presentación.
- assets de `public`: marca, equipos, competencias, TV, selecciones y PWA.

### Datos calculados

- horario Argentina y agrupación por fecha;
- estado legible, minuto y etiqueta en vivo;
- marcador con penales y agregado/global;
- clasificación, series y llaves cuando la fuente lo permite;
- forma reciente y líderes;
- notificaciones derivadas de eventos, favoritos y recordatorios;
- favoritos y recordatorios persistidos localmente;
- metadata, schema y rutas de contenido.

### Opcionalidad y estados

Pueden faltar logo, foto, estadio, árbitro, TV, minuto, eventos, estadísticas,
formación, técnico, suplentes, competición sincronizada, noticias o datos de
jugador. Suspendido, postergado y cancelado tienen estado propio. La UI nueva
debe preservar la distinción entre “sin dato”, cero y valor no aplicable.

## 7. Autenticación, privacidad y permisos

- SSR usa `@supabase/ssr` en proxy y Server Components.
- El navegador usa una instancia singleton con persistencia y auto-refresh.
- `/perfil`, Prode privado, Mi Torneito admin y `/admin` tienen necesidades de
  autorización diferentes.
- `ADMIN_EMAILS` limita el panel central.
- Los torneos privados aplican membresía, invitación y aprobación.
- Los favoritos no están ligados a la cuenta: se guardan en
  `hf:favorites:teams:v1`.
- Los recordatorios se guardan en `hf:match-reminders:v1`.
- Leído/descartado de notificaciones usa
  `hf:notifications:read:v1` y `hf:notifications:dismissed:v1`.

La versión instalada de `@supabase/ssr` es `^0.5.2`; la documentación actual
ya describe una API posterior. Actualizarla sería una migración técnica
separada, no un requisito visual.

## 8. Integraciones y dependencias

### Runtime

- Next.js 16.2.1, React 19.2.4 y TypeScript 5.
- Tailwind CSS 4 más un `globals.css` extenso.
- Supabase SSR/JS para datos y Auth.
- API-Football para proveedor deportivo.
- Sentry para errores y performance.
- Google Analytics y Vercel Analytics.
- AdSense y slots administrables.
- YouTube para highlights.
- Web Push/VAPID y service worker PWA.
- `html-to-image` para compartir.

### Infraestructura Vercel

- `vercel.json` define tres crons.
- `.vercel/project.json` vincula el repositorio a un proyecto existente.
- El proxy redirige hosts productivos concretos a `hayfulbo.com`, pero no
  redirige dominios de Preview genéricos.
- No existe `.openai/hosting.json`.
- El preview debe salir de esta rama sin `--prod`, sin promoción, dominio o
  variable de producción.

### Variables detectadas (solo nombres)

`ADMIN_CRON_SECRET`, `ADMIN_EMAILS`, `CRON_SECRET`,
`FOOTBALL_API_BASE_URL`, `FOOTBALL_API_DAILY_LIMIT`, `FOOTBALL_API_KEY`,
`FOOTBALL_API_TIMEOUT_MS`, `FOOTBALL_API_USAGE_TRACKING_ENABLED`,
`FOOTBALL_PUBLIC_READ_MODE`, `NEXT_PUBLIC_ADSENSE_DISPLAY_SLOT_ID`,
`NEXT_PUBLIC_ADSENSE_PUBLISHER_ID`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_SENTRY_DSN`,
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` y `YOUTUBE_API_KEY`, además de
identificadores móviles y configuración Sentry.

No se registraron valores y ningún secreto debe entrar al repositorio o al
bundle cliente.

## 9. Clasificación de componentes

### Lógica reutilizable que debe preservarse

- Fachada y normalizadores de `api-football`.
- `football-api-client`, auditor de llamadas, cachés y modos de lectura.
- utilidades de estado, fecha Argentina, marcador, assets y SEO.
- repositorios y servicios Supabase.
- lógica de Auth y permisos.
- servicios de favoritos, recordatorios y PWA.
- reglas de competencia, series, standings y Prode.

### Visual reutilizable con adaptación

- `AssetImage`/`SafeImage` y fallbacks;
- `MatchRow`, tarjetas de partido y reloj en vivo;
- `CompetitionSectionNav`, tablas, grupos y brackets;
- contenido editorial y share;
- formularios de Auth, Prode y Mi Torneito;
- controles PWA y slots publicitarios.

Se conserva el comportamiento y tipado, pero no se conserva automáticamente
su composición visual.

### Visual descartable

- shell, header, navegación y footer actuales;
- superficie y demo de portada de Mi Torneito;
- encabezado interno duplicado de Prode;
- decoraciones y fondos específicos de torneos;
- tarjetas, tabs y layouts cuya jerarquía pertenece al diseño anterior;
- carrusel del Mundial con assets inexistentes.

“Descartable” significa reemplazo visual, no eliminación de datos o acciones.

### Alto acoplamiento o riesgo de regresión

| Archivo/área | Tamaño aproximado | Riesgo |
| --- | ---: | --- |
| `api-football.ts` | 6.127 líneas | mezcla acceso, mapeo, fallback y modelo |
| `globals.css` | 4.899 líneas | tres sistemas de tokens y selectores globales |
| `match-detail-cache.ts` | 3.822 líneas | proveedor, persistencia y normalización |
| sincronización Prode | 3.654 líneas | datos, reglas, puntaje y escritura |
| admin TV | 2.187 líneas | UI y reglas complejas |
| `WorldCupKnockoutSection` | 2.025 líneas | simulación, persistencia y presentación |
| bracket CONMEBOL | 1.933 líneas | variantes reales de competición |
| highlights de partido | 1.899 líneas | proveedor, video y fallback |
| assets | 1.707 líneas | identidad, fuentes y fallbacks |
| admin partidos | 1.611 líneas | mutaciones con alto impacto |
| live sync | 1.558 líneas | consumo, estado y caché |
| simulador Mundial | 1.503 líneas | estado cliente complejo |
| torneos privados | 1.457 líneas | permisos, datos y acciones |
| reglas de competición | 1.423 líneas | formatos heterogéneos |
| home | 1.371 líneas | fetch, SEO y composición |
| `AppShell` | 636 líneas | navegación, Auth, audio y acciones |
| home visual | 569 líneas | presentación muy concentrada |

### Duplicación y obsolescencia

- `globals.css` declara tokens globales, del Mundial y Prode de forma
  independiente.
- Hay tarjetas de partido distintas para home, Prode, Copa Argentina y
  competencias.
- `HomeShell` mantiene un menú lateral oscuro separado del `AppShell`.
- las rutas Sentry/test son utilitarias y no producto.
- documentación de endpoints existente cubre solo una fracción de los
  handlers actuales.

## 10. Problemas encontrados en la línea de base

### Arquitectura

- Archivos de miles de líneas y responsabilidades mezcladas.
- CSS global demasiado grande, con valores hardcodeados y tres lenguajes
  visuales.
- ausencia de tests automatizados/configuración de pruebas en `main`.
- estado persistente de cliente leído durante el primer render.
- más de 90 endpoints admin; algunos GET mutan datos.
- tipado de Supabase parcial y casts deliberados para tablas no incluidas.

### UX y UI

- Header mobile con marca desproporcionada y acceso a cuenta poco visible.
- Prode muestra otra cabecera y navegación dentro del shell global.
- Mi Torneito usa resultados y tabla ficticios en su portada.
- competición/equipo pueden mostrar una sección vacía aun con datos
  relacionados disponibles.
- la lupa funciona, pero su universo de búsqueda está incompleto.
- notificaciones dependen de abrir la app y no explican claramente la
  diferencia entre agregador local y push.
- los jugadores de una formación no son enlaces, aunque el plantel del
  equipo sí los enlaza.
- el Mundial presenta cuatro imágenes de carrusel rotas.
- texto mojibake (`Â·`) visible en strings de búsqueda/notificaciones.

### Responsive

- A 390 px la formación superpone etiquetas de jugadores.
- El header consume demasiado alto en pantallas pequeñas.
- tablas/brackets tienen variantes con densidad y scroll diferentes.
- no se observó overflow horizontal en el detalle de partido probado a
  390 px, pero el dato no valida todavía todos los módulos ni anchos.

### Accesibilidad

- modales de búsqueda/notificaciones tienen rol, Escape y autofoco, pero no
  implementan un focus trap completo ni restauración explícita del foco.
- contraste bajo en enlaces verdes de Auth.
- controles de carrusel y navegación necesitan auditoría de nombre/estado.
- las formaciones solapadas impiden lectura y objetivo táctil.
- varios estados se distinguen principalmente por color.
- falta una página 404 de producto y errores segmentados con recuperación.
- el HTML con scroll suave no declara la señal esperada por Next ni una
  política clara de `prefers-reduced-motion`.

### Rendimiento

- Next advierte que la marca global es LCP sin prioridad/eager.
- CSS global voluminoso y componentes cliente monolíticos.
- World Cup, brackets y simuladores cargan mucha lógica cliente.
- `/api/global-actions-data` lee ayer/hoy/mañana y enriquece goles en una
  respuesta `no-store`; búsqueda y campana comparten caché en memoria, lo
  que evita duplicación dentro de una sesión, pero no entre visitas.
- assets rotos pasan por `/_next/image` y generan solicitudes 400.
- Ads/analytics externos pueden fallar en desarrollo; AdSense produjo un
  error DNS local y debe distinguirse de un fallo de aplicación.

### Errores funcionales reproducidos

1. Agregar un favorito funciona y persiste después de recargar.
2. En esa recarga, el servidor renderiza el estado vacío y el cliente inicia
   con `localStorage`; React informa hydration mismatch y luego se observa un
   `TypeError` al reconciliar el nodo.
3. Un valor estadístico nulo se muestra en blanco en lugar de “sin dato”.
4. Formación mobile: nombres y posiciones se superponen.
5. Mundial: cuatro assets `.webp` inexistentes devuelven 400.
6. Liga Profesional emite decenas de warnings de fallback de assets
   “A confirmar”, contaminando la consola.

## 11. Funcionalidades incompletas respecto del objetivo

- búsqueda de jugadores, noticias y torneos de Mi Torneito;
- página consolidada de favoritos (hoy es drawer/ancla/listado);
- navegación jugador desde una formación;
- estados offline/timeout uniformes;
- 404 y errores segmentados dentro del sistema visual;
- datos opcionales uniformes en estadística y equipos;
- pruebas unitarias, integración y E2E del producto;
- sistema de diseño único y documentación de componentes;
- paridad visual entre sitio, Mundial, Prode, Auth, Mi Torneito y admin;
- QA sistemático en toda la matriz de anchos solicitada.

No se inventarán capacidades de push, datos deportivos, historiales o
estadísticas que las fuentes actuales no provean.

## 12. Invariantes que no pueden romperse

1. URLs públicas, redirects, metadata, sitemap y robots.
2. Server Components y lecturas cache-only sin consumo accidental del
   proveedor.
3. estados, minuto, marcador, penales, global y zona horaria Argentina.
4. eventos, estadísticas, formaciones, TV y fallbacks de detalle.
5. formatos especiales de liga, grupos, ida/vuelta, playoff y Mundial.
6. Auth SSR, recuperación, persistencia, logout y redirects.
7. permisos de admin, Prode privado y Mi Torneito.
8. predicciones, bloqueo, puntaje, invitaciones, membresía y chat.
9. anuncios, consentimiento implícito actual, Analytics, Sentry y Search
   Console.
10. PWA, asociaciones móviles, service worker y suscripciones.
11. variables, secretos y service role únicamente en servidor.
12. tablas, RLS, funciones y datos Supabase sin cambios.
13. cron, frecuencia y límites de API-Football.
14. `main`, producción, dominios y variables de producción intactos.

## 13. Estrategia de riesgo para las etapas siguientes

- Reutilizar contratos, servicios y normalizadores; reemplazar composición y
  superficies visuales por capas.
- Corregir primero hidratación y estados base antes de reutilizar favoritos o
  recordatorios en nuevas vistas.
- Diseñar componentes deportivos adaptables, no una única tabla o bracket
  forzado.
- Mantener las páginas dinámicas y su fetch en servidor; mover al cliente
  solo interacción.
- Reservar tamaño para imágenes y anuncios.
- Probar una ruta real representativa por familia antes de declarar paridad.
- La ruta de competencia puede tardar más de 20 segundos en modo cache-only
  cuando `league-leaders` agota su timeout y Liga Profesional reconstruye
  promedios históricos. No se alteró ese contrato durante el rediseño; queda
  registrado como riesgo de performance para una optimización separada.
- Durante una detención del servidor de QA, Next.js 16.2.1 emitió una vez
  `Unexpected root span type 'ResolveMetadata.generateMetadata'`. El build,
  TypeScript y las páginas completaron correctamente; debe vigilarse en la
  verificación del Preview y en futuras actualizaciones de Next.js.
- No recorrer APIs administrativas en E2E.
- No crear migraciones ni ejecutar comandos remotos de Supabase.
- Desplegar únicamente Preview desde la rama, inspeccionar su metadata de
  Vercel y comprobar que no tiene alias productivo.

Este inventario es la línea de control contra la que se construirá y
validará la matriz de paridad.
