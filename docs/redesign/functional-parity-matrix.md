# Hay Fulbo: matriz de paridad funcional

Estado del documento: línea de base de Etapa 1  
Fecha de corte: 2026-07-29  
Base de comparación: `origin/main@5695513c3566bc90f674c9f951d38cf898601fb5`

## Cómo se usa

Esta matriz compara comportamiento, datos y navegación; no compara solamente
la presencia visual de una sección.

Estados admitidos:

- `pendiente`: todavía no fue reconstruido ni validado;
- `en desarrollo`: existe trabajo incompleto;
- `implementado`: código conectado, aún sin toda la verificación;
- `validado`: cumple todos sus controles aplicables;
- `bloqueado`: una dependencia externa impide verificarlo;
- `no aplica`: la capacidad no existe o no corresponde a la fuente actual.

Ningún renglón parte como implementado. La interfaz existente es la línea de
base, no la prueba del rediseño.

## Controles

| Código | Control para considerar una función validada |
| --- | --- |
| D | carga datos reales desde la fuente declarada |
| C | contenido y estados deportivos correctos |
| I | interacción y persistencia correctas |
| N | enlace, navegación, back y URL correctos |
| M | usable a 320, 360, 390, 412 y 430 px |
| T | usable a 768, 820 y 1024 px |
| X | usable a 1280, 1366, 1440 y 1920 px |
| L | loading/skeleton correcto y sin salto evitable |
| E | error, timeout y reintento honestos |
| Ø | vacío, dato parcial e imagen/logo ausente correctos |
| A | teclado, foco, nombre accesible, semántica y contraste |
| P | sin fetch duplicado ni regresión sensible de performance |
| Q | sin error de consola, hidratación o red atribuible a la app |
| S | contrato de servidor, secreto y permiso preservados |
| R | comparación de datos y acciones contra la versión base |

`validado` exige todos los controles indicados en su fila. Cuando una fuente
no puede producir un estado (por ejemplo, formación para un partido sin esa
información), la validación consiste en representar la ausencia con
honestidad, no en inventar datos.

## 1. Shell, navegación y acciones globales

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Shell | layout global, marca y contenido | todas | Server Components + configuración local | pendiente | N,M,T,X,A,P,Q,R |
| Shell | sidebar desktop | todas | navegación local | pendiente | I,N,X,A,Q,R |
| Shell | navegación mobile inferior | todas | navegación local | pendiente | I,N,M,T,A,Q,R |
| Shell | menú mobile “Más” | todas | navegación local + sesión | pendiente | I,N,M,A,Q,R |
| Shell | navegación contextual por torneo | `/liga/[id]` | configuración de competencia | pendiente | D,I,N,M,T,X,A,Q,R |
| Shell | footer y enlaces legales | todas | local | pendiente | I,N,M,T,X,A,Q,R |
| Shell | botón volver | rutas de detalle | historial del router | pendiente | I,N,M,T,X,A,Q |
| Shell | selector de idioma | todas | cookie/locales | pendiente | I,N,M,T,X,A,Q,R |
| Shell | preferencias de audio de torneo | competencias compatibles | localStorage | pendiente | I,M,X,A,Q,R |
| Búsqueda | abrir, cerrar, Escape y autofoco | todas | estado cliente | pendiente | I,M,T,X,A,Q |
| Búsqueda | foco confinado y restaurado | todas | estado cliente | pendiente | I,M,T,X,A,Q |
| Búsqueda | equipos y selecciones | todas | caché de partidos/equipos | pendiente | D,I,N,M,X,L,E,Ø,A,Q,R |
| Búsqueda | competiciones | todas | configuración de torneos | pendiente | D,I,N,M,X,L,E,Ø,A,Q,R |
| Búsqueda | partidos | todas | caché ayer/hoy/mañana | pendiente | D,C,I,N,M,X,L,E,Ø,A,P,Q,R |
| Búsqueda | jugadores | todas | Supabase/API-Football disponible | pendiente | D,I,N,M,X,L,E,Ø,A,P,Q |
| Búsqueda | noticias y mercado | todas | contenido local | pendiente | D,I,N,M,X,L,E,Ø,A,Q |
| Búsqueda | torneos Mi Torneito | todas | Supabase | pendiente | D,I,N,M,X,L,E,Ø,A,S,Q |
| Búsqueda | páginas y accesos del producto | todas | catálogo local | pendiente | D,I,N,M,X,Ø,A,Q,R |
| Búsqueda | navegación por teclado entre resultados | todas | estado cliente | pendiente | I,M,X,A,Q |
| Favoritos | agregar equipo/selección | equipo, home, búsqueda | localStorage actual | pendiente | D,I,N,M,X,Ø,A,Q,R |
| Favoritos | quitar favorito | shell, equipo, búsqueda | localStorage actual | pendiente | I,M,X,Ø,A,Q,R |
| Favoritos | persistencia después de recarga | todas | localStorage actual | pendiente | I,M,X,Q,R |
| Favoritos | listado/acceso dedicado | shell/home | localStorage actual | pendiente | D,I,N,M,T,X,Ø,A,Q,R |
| Favoritos | usuario no autenticado | todas | localStorage actual | pendiente | I,Ø,A,Q,R |
| Notificaciones | abrir/cerrar campana | todas | estado cliente | pendiente | I,M,T,X,A,Q |
| Notificaciones | recordatorios | todas | localStorage | pendiente | D,I,N,M,X,Ø,A,Q,R |
| Notificaciones | equipos favoritos | todas | favoritos + partidos | pendiente | D,C,I,N,M,X,Ø,A,Q,R |
| Notificaciones | partido/evento en vivo | todas | caché/eventos | pendiente | D,C,I,N,M,X,Ø,A,P,Q,R |
| Notificaciones | leído y limpiar | todas | localStorage | pendiente | I,M,X,Ø,A,Q,R |
| Notificaciones | estado sin novedades | todas | agregado cliente | pendiente | Ø,M,X,A,Q,R |
| PWA | prompt de instalación | todas | navegador + localStorage | pendiente | I,M,T,X,Ø,A,Q,R |
| PWA | opt-in de push | todas | Notification API/VAPID | pendiente | D,I,M,T,X,E,Ø,A,S,Q,R |
| PWA | alta/baja de suscripción | `/api/pwa/push-subscriptions` | Supabase | pendiente | D,I,E,Ø,S,Q,R |

## 2. Home y descubrimiento de partidos

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Home | fecha actual Argentina | `/` | utilidades Argentina | pendiente | C,M,T,X,Q,R |
| Home | anterior, hoy y siguiente | `/` | navegación por query/fecha | pendiente | I,N,M,T,X,A,Q,R |
| Home | selector de fecha | `/` | estado/URL | pendiente | I,N,M,T,X,A,Q,R |
| Home | partidos en vivo | `/` | caché Supabase + live sync | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Home | próximos partidos | `/` | caché Supabase | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Home | partidos finalizados | `/` | caché Supabase | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Home | suspendido/postergado/cancelado | `/` | estado del fixture | pendiente | D,C,I,N,M,T,X,Ø,A,Q,R |
| Home | agrupación por competencia | `/` | fixture + config | pendiente | D,C,I,N,M,T,X,Ø,A,Q,R |
| Home | marcador, penales y minuto | `/` | fixture normalizado | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Home | incidencias/goleadores | `/` | eventos/caché | pendiente | D,C,M,T,X,E,Ø,A,P,Q,R |
| Home | televisión | `/` | broadcasts y overrides | pendiente | D,C,I,M,T,X,Ø,A,Q,R |
| Home | enlaces a partido | `/` | fixture id | pendiente | D,I,N,M,T,X,A,Q,R |
| Home | enlaces a equipo/selección | `/` | team id | pendiente | D,I,N,M,T,X,A,Q,R |
| Home | enlaces a competencia | `/` | config/league id | pendiente | D,I,N,M,T,X,A,Q,R |
| Home | favoritos destacados | `/` | localStorage + partidos | pendiente | D,I,N,M,T,X,Ø,A,Q,R |
| Home | noticias importantes | `/` | contenido local | pendiente | D,I,N,M,T,X,Ø,A,Q,R |
| Home | accesos rápidos | `/` | navegación local | pendiente | I,N,M,T,X,A,Q |
| Home | sin partidos en fecha | `/` | caché vacía | pendiente | Ø,M,T,X,A,Q,R |
| Home | carga, error, offline y timeout | `/` | servidor/red | pendiente | L,E,Ø,M,T,X,A,Q |
| Home | actualización en vivo sin duplicados | `/` | endpoint live sync | pendiente | D,C,P,Q,R |

## 3. Detalle e historial de partido

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Partido | competencia, etapa y jornada | `/partido/[id]` | fixture/caché | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Partido | fecha, hora Argentina y estado | `/partido/[id]` | fixture normalizado | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Partido | equipos, escudos y navegación | `/partido/[id]` | fixture/teams | pendiente | D,C,I,N,M,T,X,Ø,A,Q,R |
| Partido | minuto y agregado | `/partido/[id]` | fixture/live sync | pendiente | D,C,M,T,X,Ø,A,P,Q,R |
| Partido | marcador, penales y global | `/partido/[id]` | fixture/serie | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Partido | estadio, árbitro y TV | `/partido/[id]` | fixture/broadcasts | pendiente | D,C,I,M,T,X,Ø,A,Q,R |
| Partido | recordatorio | `/partido/[id]` | localStorage | pendiente | I,M,T,X,Ø,A,Q,R |
| Partido | compartir | `/partido/[id]` | Web Share/share card | pendiente | D,I,M,T,X,E,Ø,A,Q,R |
| Partido | tabs y anclas | `/partido/[id]` | navegación local | pendiente | I,N,M,T,X,A,Q |
| Resumen | goleadores e incidencias clave | `/partido/[id]` | eventos | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Cronología | goles, autogoles y penales | `/partido/[id]` | `/fixtures/events`/caché | pendiente | D,C,M,T,X,E,Ø,A,Q,R |
| Cronología | penales errados | `/partido/[id]` | eventos | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Cronología | tarjetas | `/partido/[id]` | eventos | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Cronología | cambios, VAR y lesiones | `/partido/[id]` | eventos | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Cronología | tiempo agregado y eventos desconocidos | `/partido/[id]` | eventos normalizados | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Estadísticas | porcentajes | `/partido/[id]` | estadísticas | pendiente | D,C,M,T,X,E,Ø,A,Q,R |
| Estadísticas | valores absolutos | `/partido/[id]` | estadísticas | pendiente | D,C,M,T,X,E,Ø,A,Q,R |
| Estadísticas | valor cero, igual o nulo | `/partido/[id]` | estadísticas | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Formaciones | dibujo táctico y once | `/partido/[id]` | lineups | pendiente | D,C,M,T,X,E,Ø,A,Q,R |
| Formaciones | posiciones, nombres y dorsales | `/partido/[id]` | lineups | pendiente | D,C,I,N,M,T,X,Ø,A,Q,R |
| Formaciones | suplentes | `/partido/[id]` | lineups | pendiente | D,C,I,N,M,T,X,Ø,A,Q,R |
| Formaciones | entrenadores | `/partido/[id]` | lineups | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Formaciones | cambios y jugador enlazado | `/partido/[id]` | lineup/eventos/player id | pendiente | D,C,I,N,M,T,X,Ø,A,Q |
| Formaciones | formación ausente | `/partido/[id]` | caché vacía | pendiente | Ø,M,T,X,A,Q,R |
| Videos | highlights reales | `/partido/[id]` | YouTube/caché | pendiente | D,I,M,T,X,L,E,Ø,A,P,Q,R |
| Historial | enfrentamientos directos | `/partido/[id]/historial` | caché/head-to-head | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Partido | actualización en vivo | `/partido/[id]` | live sync | pendiente | D,C,P,Q,R |
| Partido | loading, error y no encontrado | `/partido/[id]` | App Router | pendiente | L,E,Ø,N,M,T,X,A,Q |

## 4. Competencias, tablas, grupos y llaves

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Competencias | catálogo y acceso | `/competiciones` | config de torneos | pendiente | D,I,N,M,T,X,L,E,Ø,A,Q,R |
| Competencia | identidad, país y temporada | `/liga/[id]` | config + Supabase | pendiente | D,C,N,M,T,X,L,E,Ø,A,Q,R |
| Competencia | fase/jornada actual | `/liga/[id]` | fixture/reglas | pendiente | D,C,I,N,M,T,X,Ø,A,Q,R |
| Competencia | fixture por fecha/fase | `/liga/[id]` | caché de fixtures | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Competencia | navegación a partido/equipo | `/liga/[id]` | ids del fixture | pendiente | D,I,N,M,T,X,A,Q,R |
| Tabla | liga general | `/liga/[id]`, `/tablas` | standings cache | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Tabla | zonas y grupos | `/liga/[id]` | standings/reglas | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Tabla | clasificación/promedios/descenso | `/liga/[id]` | standings + reglas locales | pendiente | D,C,M,T,X,E,Ø,A,Q,R |
| Tabla | forma y estados V/E/D | `/liga/[id]` | standings | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Llaves | partido único | `/liga/[id]` | fixtures/reglas | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Llaves | ida/vuelta y global | `/liga/[id]` | fixtures/series | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Llaves | penales | `/liga/[id]` | fixtures | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Líderes | goleadores | `/liga/[id]`, `/estadisticas` | caché/API-Football | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Líderes | asistencias y tarjetas | `/liga/[id]`, `/estadisticas` | caché/API-Football | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Competencia | equipos participantes | `/liga/[id]` | fixtures/standings | pendiente | D,C,I,N,M,T,X,Ø,A,Q,R |
| Competencia | noticias e historia | `/liga/[id]` | contenido local/campeones | pendiente | D,I,N,M,T,X,Ø,A,Q,R |
| Campeones | historial | `/liga/[id]/campeones` | tablas locales/Supabase | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Competencia | sedes cuando existen | `/liga/[id]` | config/equipos | pendiente | D,C,I,N,M,T,X,Ø,A,Q |
| Competencia | sin fixture/tabla/líderes | `/liga/[id]` | fuente vacía | pendiente | Ø,M,T,X,A,Q,R |
| Competencia | variantes Argentina/CONMEBOL/UEFA | `/liga/[id]` | reglas específicas | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |

## 5. Mundial 2026

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Mundial | portada integrada al sitio | `/liga/selecciones-mundial` | config + contenido + datos | pendiente | D,N,M,T,X,L,E,Ø,A,P,Q,R |
| Mundial | partidos y TV | misma | fixtures/broadcasts | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Mundial | grupos y clasificación | misma | standings/reglas | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Mundial | llaves reales | misma | fixtures/series | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Mundial | simulador | misma | estado local/reglas | pendiente | I,M,T,X,Ø,A,P,Q,R |
| Mundial | estadísticas y goleadores | misma | caché/API-Football | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Mundial | selecciones y jugadores | misma | equipos/planteles | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Mundial | sedes | misma | config/equipos | pendiente | D,C,I,N,M,T,X,Ø,A,Q,R |
| Mundial | noticias e historia | misma | contenido local/Supabase historial | pendiente | D,I,N,M,T,X,Ø,A,Q,R |
| Mundial | favoritos | misma | localStorage | pendiente | D,I,N,M,T,X,Ø,A,Q,R |
| Mundial | assets reales/fallback | misma | `public`/remotos | pendiente | D,M,T,X,Ø,A,P,Q,R |
| Mundial | estados sin datos | misma | fuentes vacías | pendiente | Ø,M,T,X,A,Q,R |

## 6. Equipos, selecciones y jugadores

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Equipo | identidad, escudo, país | `/equipo/[id]` | Supabase + `/teams` | pendiente | D,C,M,T,X,L,E,Ø,A,P,Q,R |
| Equipo | estadio y entrenador | `/equipo/[id]` | team/venue/squad | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Equipo | competiciones clickeables | `/equipo/[id]` | fixtures/standings | pendiente | D,C,I,N,M,T,X,Ø,A,Q,R |
| Equipo | competiciones primero en mobile | `/equipo/[id]` | layout | pendiente | M,T,A,Q,R |
| Equipo | plantel y jugadores | `/equipo/[id]` | `/players/squads` + `/players` | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Equipo | forma reciente | `/equipo/[id]` | fixtures | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Equipo | próximos partidos | `/equipo/[id]` | fixtures/cache | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Equipo | últimos resultados | `/equipo/[id]` | fixtures/cache | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Equipo | estadísticas | `/equipo/[id]` | player/team aggregates | pendiente | D,C,M,T,X,E,Ø,A,Q,R |
| Equipo | títulos, participaciones y descensos | `/equipo/[id]` | extras locales/cache | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Equipo | ranking FIFA de selección | `/equipo/[id]` | extras disponibles | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Equipo | noticias | `/equipo/[id]` | contenido local | pendiente | D,I,N,M,T,X,Ø,A,Q,R |
| Equipo | favorito | `/equipo/[id]` | localStorage | pendiente | I,M,T,X,A,Q,R |
| Equipo | dato/logo/competición ausente | `/equipo/[id]` | fuentes parciales | pendiente | Ø,M,T,X,A,Q,R |
| Jugador | foto, nombre y nacionalidad | `/jugador/[id]` | Supabase + `/players` | pendiente | D,C,M,T,X,L,E,Ø,A,P,Q,R |
| Jugador | edad, posición y dorsal | `/jugador/[id]` | `/players`/squad | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Jugador | club y selección navegables | `/jugador/[id]` | estadísticas/equipo | pendiente | D,C,I,N,M,T,X,Ø,A,Q,R |
| Jugador | estadísticas, goles y asistencias | `/jugador/[id]` | `/players` | pendiente | D,C,M,T,X,E,Ø,A,Q,R |
| Jugador | tarjetas, partidos y competiciones | `/jugador/[id]` | player/event matches | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Jugador | trayectoria | `/jugador/[id]` | datos disponibles | pendiente | D,C,M,T,X,Ø,A,Q |
| Jugador | noticias | `/jugador/[id]` | contenido disponible | pendiente | D,I,N,M,T,X,Ø,A,Q |
| Jugador | información parcial/no encontrado | `/jugador/[id]` | App Router/fuente parcial | pendiente | E,Ø,N,M,T,X,A,Q,R |

## 7. Noticias, análisis y mercado

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Noticias | portada editorial | `/noticias` | contenido local | pendiente | D,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Noticias | categorías/listado | `/noticias` | contenido local | pendiente | D,I,N,M,T,X,Ø,A,Q,R |
| Artículo | título, bajada e imagen | `/noticias/[slug]` | contenido local | pendiente | D,M,T,X,Ø,A,P,Q,R |
| Artículo | autor, fecha y tiempo de lectura | `/noticias/[slug]` | metadata local | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Artículo | cuerpo y encabezados | `/noticias/[slug]` | contenido local | pendiente | D,M,T,X,A,Q,R |
| Artículo | relacionados y compartir | `/noticias/[slug]` | contenido/share | pendiente | D,I,N,M,T,X,E,Ø,A,Q,R |
| Artículo | SEO y dato estructurado | `/noticias/[slug]` | metadata/SEO | pendiente | D,C,N,Q,R |
| Noticias | imagen o listado ausente | noticias | fallback/colección vacía | pendiente | Ø,M,T,X,A,Q,R |
| Mercado | listado y categorías | `/mercado-de-pases` | contenido local | pendiente | D,I,N,M,T,X,L,E,Ø,A,Q,R |
| Mercado | artículo | `/mercado-de-pases/[slug]` | contenido local | pendiente | D,I,N,M,T,X,L,E,Ø,A,Q,R |
| Análisis | listado | `/analisis` | Markdown local | pendiente | D,I,N,M,T,X,L,E,Ø,A,Q,R |
| Análisis | guía/artículo | `/analisis/[slug]` | Markdown local | pendiente | D,I,N,M,T,X,L,E,Ø,A,Q,R |

## 8. Prode

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Prode | portada/listado de partidos | `/prode` | API propia + Supabase | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,S,Q,R |
| Prode | filtros de partidos | `/prode` | estado cliente | pendiente | I,M,T,X,Ø,A,Q,R |
| Prode | formulario de pronóstico | `/prode` | API/Supabase autenticado | pendiente | D,C,I,M,T,X,L,E,Ø,A,S,Q,R |
| Prode | bloqueo por horario/estado | `/prode` | reglas + fixture | pendiente | D,C,I,M,T,X,Ø,A,S,Q,R |
| Prode | pronóstico persistido | `/prode` | predictions | pendiente | D,C,I,L,E,S,Q,R |
| Prode | puntaje y explicación | `/prode` | scores/results | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Prode | ranking | `/prode` | leaderboard | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Prode | grupos Mundial | `/prode` | endpoint world-cup-groups | pendiente | D,C,M,T,X,L,E,Ø,A,Q,R |
| Prode privado | lista, búsqueda y creación | `/prode/torneos` | Supabase/API propia | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Prode privado | detalle y miembros | `/prode/torneos/[id]` | Supabase/API propia | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Prode privado | invitación/aceptar/revocar | invitación/detalle | Supabase/API propia | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Prode privado | solicitud/aprobar/rechazar | detalle | Supabase/API propia | pendiente | D,I,M,T,X,L,E,Ø,A,S,Q,R |
| Prode privado | chat y eliminación | detalle | Supabase/API propia | pendiente | D,I,M,T,X,L,E,Ø,A,S,Q,R |
| Prode | sesión ausente/vencida | todas Prode | Supabase Auth | pendiente | I,N,M,T,X,E,Ø,A,S,Q,R |

## 9. Mi Torneito

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Mi Torneito | portada sin datos ficticios | `/mi-torneito` | contenido local + Supabase real | pendiente | D,I,N,M,T,X,Ø,A,Q,R |
| Mi Torneito | listado de torneos | `/mi-torneito/torneos` | repositorio Supabase | pendiente | D,I,N,M,T,X,L,E,Ø,A,P,S,Q,R |
| Mi Torneito | solicitud de torneo | `/mi-torneito/solicitar` | Supabase | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Torneo | identidad y navegación | `/mi-torneito/t/[tournamentSlug]` | Supabase | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Torneo | fixture y fechas | misma | rounds/matches | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Torneo | resultados | misma | matches | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Torneo | tabla | misma | partidos calculados/datos | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Torneo | equipos y planteles | torneo/equipo | teams | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Torneo | goleadores | misma | partidos/eventos disponibles | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Torneo | detalle de partido | `/mi-torneito/t/[tournamentSlug]/p/[matchId]` | matches | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Torneo | detalle de equipo | `/mi-torneito/t/[tournamentSlug]/e/[teamSlug]` | teams/matches | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Organizador | acceso por permiso | `/mi-torneito/admin` | Auth/admin assignments | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Organizador | carga y edición | `/mi-torneito/admin` | repositorio Supabase | pendiente | D,C,I,M,T,X,L,E,Ø,A,S,Q,R |
| Organizador | confirmaciones y errores | `/mi-torneito/admin` | estado de mutación | pendiente | I,M,T,X,E,Ø,A,S,Q,R |
| Mi Torneito | sin torneos/sin datos | todas | colecciones vacías | pendiente | Ø,M,T,X,A,Q,R |

## 10. Autenticación, perfil y administración

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Auth | iniciar sesión | `/login` | Supabase Auth | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Auth | registro | `/register` | Supabase Auth + profile | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Auth | recuperación por correo | `/restablecer-contrasena` | Supabase Auth | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Auth | callback y redirección | `/auth/callback` | Supabase SSR | pendiente | D,I,N,E,S,Q,R |
| Auth | sesión persistente | todas | cookies Supabase SSR | pendiente | D,I,N,M,X,S,Q,R |
| Auth | cerrar sesión | shell/perfil | Supabase Auth | pendiente | D,I,N,M,T,X,L,E,A,S,Q,R |
| Auth | ruta protegida y sesión vencida | perfil/privadas/admin | proxy + servidor | pendiente | D,I,N,E,Ø,A,S,Q,R |
| Perfil | datos y preferencias | `/perfil` | profiles/Auth | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Admin | login separado | `/admin/login` | Supabase Auth | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Admin | control `ADMIN_EMAILS` | `/admin/*` | servidor | pendiente | D,I,N,E,Ø,S,Q,R |
| Admin | dashboard | `/admin` | servicios admin | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Admin | anuncios | `/admin/ads` | admin_ad_slots | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Admin | TV | `/admin/broadcasts` | reglas/overrides | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Admin | destacados | `/admin/featured-matches` | featured matches | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Admin | partidos | `/admin/matches` | matches/overrides | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Admin | sincronización | `/admin/sync` | handlers admin | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Admin | visibilidad | `/admin/visibility` | visibility rules | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |
| Admin | Mi Torneito | `/admin/mi-torneito/*` | tablas Mi Torneito | pendiente | D,I,N,M,T,X,L,E,Ø,A,S,Q,R |

## 11. Plataforma, SEO, anuncios y estados transversales

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| SEO | title y description | públicas | metadata API | pendiente | D,C,N,Q,R |
| SEO | canonical | públicas | `SITE_URL` | pendiente | D,C,N,Q,R |
| SEO | Open Graph/Twitter | públicas | metadata/contenido | pendiente | D,C,Q,R |
| SEO | datos estructurados | contenido/deporte | builders locales | pendiente | D,C,Q,R |
| SEO | sitemap y robots | `/sitemap.xml`, `/robots.txt` | rutas/contenido | pendiente | D,C,N,Q,R |
| SEO | enlaces internos/headings | públicas | UI | pendiente | I,N,M,T,X,A,Q,R |
| SEO | alias/redirecciones | legacy | App Router | pendiente | N,Q,R |
| Ads | script y cuenta | todas habilitadas | env/config | pendiente | D,M,T,X,E,Ø,P,Q,R |
| Ads | slot sin CLS | rutas habilitadas | admin/env | pendiente | D,M,T,X,Ø,A,P,Q,R |
| Analítica | Google Analytics | todas | env/script | pendiente | D,S,Q,R |
| Analítica | Vercel Analytics | todas | Vercel | pendiente | D,S,Q,R |
| Observabilidad | Sentry | errores | Sentry config | pendiente | D,E,S,Q,R |
| Error | error global recuperable | todas | App Router/Sentry | pendiente | I,N,M,T,X,E,A,Q |
| Error | error segmentado | módulos de datos | App Router | pendiente | I,N,M,T,X,E,A,Q |
| Error | 404 de producto | ruta inexistente | App Router | pendiente | N,M,T,X,Ø,A,Q |
| Estado | skeletons consistentes | páginas de datos | loading.tsx/componentes | pendiente | L,M,T,X,A,P,Q |
| Estado | offline y timeout | páginas interactivas | navegador/red | pendiente | E,Ø,M,T,X,A,Q |
| Estado | sesión vencida/permiso insuficiente | protegidas | Auth/permisos | pendiente | E,Ø,N,M,T,X,A,S,Q |
| Assets | logo/foto/imagen ausente | todas | fallback local | pendiente | Ø,M,T,X,A,P,Q,R |
| Responsive | sin overflow ni solapamiento | todas | CSS/layout | pendiente | M,T,X,A,Q |
| Accesibilidad | landmarks y jerarquía | todas | HTML | pendiente | M,T,X,A,Q |
| Accesibilidad | foco visible y orden | todas | HTML/CSS | pendiente | I,M,T,X,A,Q |
| Accesibilidad | reduced motion | todas | CSS/cliente | pendiente | M,T,X,A,Q |
| Performance | imágenes y LCP | públicas | Next Image/assets | pendiente | M,T,X,P,Q |
| Performance | bundle e hidratación | todas | RSC/client boundaries | pendiente | P,Q,R |
| Seguridad | secretos solo servidor | todas | env/server-only | pendiente | S,Q,R |
| Seguridad | producción/Supabase intactos | infraestructura | Git/Vercel/Supabase | pendiente | S,Q,R |

## 12. Condición de salida

La versión puede considerarse funcionalmente completa solo cuando:

1. no haya capacidades críticas en `pendiente`, `en desarrollo` o
   `bloqueado`;
2. cada fila `validado` tenga evidencia de datos, interacción y viewport;
3. las ausencias reales se prueben como estados vacíos, no como contenido
   inventado;
4. consola, hidratación y red estén limpias de errores atribuibles a la app;
5. la regresión confirme que no desaparecieron datos, acciones o URLs;
6. el deployment inspeccionado sea Preview y corresponda al commit final de
   esta rama.

La matriz se actualizará durante cada módulo y será la fuente del informe
final; nunca se completará retrospectivamente sin evidencia.
