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
| Shell | layout global, marca y contenido | todas | Server Components + configuración local | validado | N,M,T,X,A,P,Q,R |
| Shell | sidebar desktop | todas | navegación local | no aplica | reemplazada por navegación horizontal según la nueva IA |
| Shell | navegación mobile inferior | todas | navegación local | validado | I,N,M,T,A,Q,R |
| Shell | menú mobile “Más” | todas | navegación local + sesión | validado | I,N,M,A,Q,R |
| Shell | navegación contextual por torneo | `/liga/[id]` | configuración de competencia | pendiente | D,I,N,M,T,X,A,Q,R |
| Shell | footer y enlaces legales | todas | local | implementado | I,N,M,T,X,A,Q,R |
| Shell | botón volver | rutas de detalle | historial del router | implementado | I,N,M,T,X,A,Q |
| Shell | selector de idioma | todas | cookie/locales | pendiente | I,N,M,T,X,A,Q,R |
| Shell | preferencias de audio de torneo | competencias compatibles | localStorage | pendiente | I,M,X,A,Q,R |
| Búsqueda | abrir, cerrar, Escape y autofoco | todas | estado cliente | validado | I,M,T,X,A,Q |
| Búsqueda | foco confinado y restaurado | todas | estado cliente | validado | I,M,T,X,A,Q |
| Búsqueda | equipos y selecciones | todas | caché de partidos/equipos | validado | D,I,N,M,X,L,E,Ø,A,Q,R |
| Búsqueda | competiciones | todas | configuración de torneos | implementado | D,I,N,M,X,L,E,Ø,A,Q,R |
| Búsqueda | partidos | todas | caché ayer/hoy/mañana | implementado | D,C,I,N,M,X,L,E,Ø,A,P,Q,R |
| Búsqueda | jugadores | todas | Supabase/API-Football disponible | validado | D,I,N,M,X,L,E,Ø,A,P,Q |
| Búsqueda | noticias y mercado | todas | contenido local | implementado | D,I,N,M,X,L,E,Ø,A,Q |
| Búsqueda | torneos Mi Torneito | todas | Supabase | implementado | fuente real conectada; sin torneos públicos coincidentes para validar |
| Búsqueda | páginas y accesos del producto | todas | catálogo local | validado | D,I,N,M,X,Ø,A,Q,R |
| Búsqueda | navegación por teclado entre resultados | todas | estado cliente | validado | I,M,X,A,Q |
| Favoritos | agregar equipo/selección | equipo, home, búsqueda | localStorage actual | validado | D,I,N,M,X,Ø,A,Q,R |
| Favoritos | quitar favorito | shell, equipo, búsqueda | localStorage actual | validado | I,M,X,Ø,A,Q,R |
| Favoritos | persistencia después de recarga | todas | localStorage actual | validado | I,M,X,Q,R |
| Favoritos | listado/acceso dedicado | shell/home | localStorage/Supabase actual | validado | Panel único de equipos y competiciones accesible desde mobile y desktop; navegación, vacío y 12 anchos comprobados. |
| Favoritos | usuario no autenticado | todas | localStorage actual | validado | I,Ø,A,Q,R |
| Favoritos | competiciones con sesión | shell/navegación | Supabase con fallback local | implementado | Consulta, eliminación optimista, error y fallback preservados; mutación remota positiva no ejecutada para no alterar datos reales. |
| Notificaciones | abrir/cerrar campana | todas | estado cliente | validado | Diálogo, foco inicial, Escape, retorno de foco y cierre comprobados. |
| Notificaciones | recordatorios | todas | localStorage | validado | Recordatorio persistido con el mecanismo real, contador, contenido y navegación renderizados. |
| Notificaciones | equipos favoritos | todas | favoritos + partidos | implementado | Cruce por ID/nombre y estados próximo/en vivo preservado; el dataset de QA no produjo un partido favorito activo. |
| Notificaciones | partido/evento en vivo | todas | caché/eventos | implementado | Agregación y prioridades conectadas a caché real; falta un evento en vivo positivo durante la ventana de QA. |
| Notificaciones | leído y limpiar | todas | localStorage | validado | Marcar leídas, contador, persistencia y limpiar comprobados sin infraestructura simulada de push. |
| Notificaciones | estado sin novedades | todas | agregado cliente | validado | Vacío honesto posterior a limpiar comprobado; error y carga diferenciados implementados. |
| PWA | prompt de instalación | todas | navegador + localStorage | pendiente | I,M,T,X,Ø,A,Q,R |
| PWA | opt-in de push | todas | Notification API/VAPID | pendiente | D,I,M,T,X,E,Ø,A,S,Q,R |
| PWA | alta/baja de suscripción | `/api/pwa/push-subscriptions` | Supabase | pendiente | D,I,E,Ø,S,Q,R |

## 2. Home y descubrimiento de partidos

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Home | fecha actual Argentina | `/` | utilidades Argentina | implementado | Fecha del servidor normalizada a Argentina; falta prueba temporal aislada. |
| Home | anterior, hoy y siguiente | `/` | navegación por query/fecha | validado | Cambio real de URL/fecha en Playwright. |
| Home | selector de fecha | `/` | estado/URL | validado | Envío real del formulario y retorno a jornada con datos. |
| Home | partidos en vivo | `/` | caché Supabase + live sync | implementado | Sección, estado y vacío implementados; live sync se intercepta en QA para evitar escrituras. |
| Home | próximos partidos | `/` | caché Supabase | validado | Datos reales, horarios, enlaces y responsive 320–1920 px. |
| Home | partidos finalizados | `/` | caché Supabase | validado | 24 resultados reales, marcadores e incidencias verificados. |
| Home | suspendido/postergado/cancelado | `/` | estado del fixture | validado | Cuatro postergados reales conservados en sección específica. |
| Home | agrupación por competencia | `/` | fixture + config | validado | Identidad, enlace y conteo por competencia comprobados. |
| Home | marcador, penales y minuto | `/` | fixture normalizado | validado | Marcadores y penales reales renderizados con estado textual. |
| Home | incidencias/goleadores | `/` | eventos/caché | validado | Goleadores reales visibles también en mobile. |
| Home | televisión | `/` | broadcasts y overrides | implementado | Render condicional conectado; fecha QA sin transmisión confirmada. |
| Home | enlaces a partido | `/` | fixture id | validado | Todos los href únicos apuntan a `/partido/[id]`. |
| Home | enlaces a equipo/selección | `/` | team id | validado | Enlaces reales a `/equipo/[id]` comprobados. |
| Home | enlaces a competencia | `/` | config/league id | validado | Enlaces reales a `/liga/[id]` comprobados. |
| Home | favoritos destacados | `/` | localStorage + partidos | validado | Persistencia, render y eliminación real verificados. |
| Home | noticias importantes | `/` | contenido local | validado | Contenido real y enlaces editoriales comprobados. |
| Home | accesos rápidos | `/` | navegación local | validado | Cuatro destinos reales presentes y accesibles. |
| Home | sin partidos en fecha | `/` | caché vacía | implementado | Estado único implementado; falta fixture de QA completamente vacío. |
| Home | carga, error, offline y timeout | `/` | servidor/red | pendiente | L,E,Ø,M,T,X,A,Q |
| Home | actualización en vivo sin duplicados | `/` | endpoint live sync | implementado | Deduplicación por fixture id validada; sincronización real no ejecutada en QA aislado. |

## 3. Detalle e historial de partido

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Partido | competencia, etapa y jornada | `/partido/[id]` | fixture/caché | validado | Ronda y competencia reales con navegación comprobada. |
| Partido | fecha, hora Argentina y estado | `/partido/[id]` | fixture normalizado | validado | Fecha Argentina y estado FINAL 96' verificados. |
| Partido | equipos, escudos y navegación | `/partido/[id]` | fixture/teams | validado | Dos equipos reales, escudos y enlaces comprobados. |
| Partido | minuto y agregado | `/partido/[id]` | fixture/live sync | implementado | Minuto/agregado renderizados; falta fixture en vivo aislado. |
| Partido | marcador, penales y global | `/partido/[id]` | fixture/serie | implementado | Marcador validado; falta caso QA con penales/global. |
| Partido | estadio, árbitro y TV | `/partido/[id]` | fixture/broadcasts | validado | Estadio y árbitro reales; ausencia de TV representada honestamente. |
| Partido | recordatorio | `/partido/[id]` | localStorage | validado | Alta, estado accesible y baja en fixture próximo. |
| Partido | compartir | `/partido/[id]` | Web Share/share card | implementado | Diálogo abre/cierra con Escape; generación/compartir externo no ejecutados. |
| Partido | tabs y anclas | `/partido/[id]` | navegación local | validado | Seis destinos contextuales y scroll a estadísticas comprobados. |
| Resumen | goleadores e incidencias clave | `/partido/[id]` | eventos | validado | Resumen real y cronología de 17 eventos comprobados. |
| Cronología | goles, autogoles y penales | `/partido/[id]` | `/fixtures/events`/caché | implementado | Goles validados; faltan fixtures QA con autogol y penal. |
| Cronología | penales errados | `/partido/[id]` | eventos | implementado | Normalización y presentación preservadas; sin caso QA. |
| Cronología | tarjetas | `/partido/[id]` | eventos | validado | Amarillas reales verificadas. |
| Cronología | cambios, VAR y lesiones | `/partido/[id]` | eventos | implementado | Cambios validados; VAR y lesión sin caso QA. |
| Cronología | tiempo agregado y eventos desconocidos | `/partido/[id]` | eventos normalizados | implementado | Agregado 90+5/45+2 validado; evento desconocido sin caso QA. |
| Estadísticas | porcentajes | `/partido/[id]` | estadísticas | validado | Posesión y precisión reales verificadas. |
| Estadísticas | valores absolutos | `/partido/[id]` | estadísticas | validado | 16 métricas reales renderizadas. |
| Estadísticas | valor cero, igual o nulo | `/partido/[id]` | estadísticas | validado | Ceros/empates visibles y todas las barras limitadas a 0–100 %. |
| Formaciones | dibujo táctico y once | `/partido/[id]` | lineups | validado | Dos campos tácticos completos comprobados. |
| Formaciones | posiciones, nombres y dorsales | `/partido/[id]` | lineups | validado | Datos reales visibles en mobile y desktop. |
| Formaciones | suplentes | `/partido/[id]` | lineups | validado | Cambio de tab y estado `aria-pressed` comprobados. |
| Formaciones | entrenadores | `/partido/[id]` | lineups | validado | Entrenadores reales visibles por equipo. |
| Formaciones | cambios y jugador enlazado | `/partido/[id]` | lineup/eventos/player id | implementado | Cambios visibles; navegación de jugador queda para módulo jugadores. |
| Formaciones | formación ausente | `/partido/[id]` | caché vacía | validado | Estado honesto verificado con partido postergado. |
| Videos | highlights reales | `/partido/[id]` | YouTube/caché | validado | Fuente real e iframe lazy comprobados; recurso publicitario externo permitido por dominio. |
| Historial | enfrentamientos directos | `/partido/[id]/historial` | caché/head-to-head | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,P,Q,R |
| Partido | actualización en vivo | `/partido/[id]` | live sync | implementado | Contrato preservado; endpoint interceptado en QA para impedir escrituras. |
| Partido | loading, error y no encontrado | `/partido/[id]` | App Router | pendiente | L,E,Ø,N,M,T,X,A,Q |

## 4. Competencias, tablas, grupos y llaves

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Competencias | catálogo y acceso | `/competiciones` | config de torneos | validado | Catálogo real, filtro, cero resultados, enlaces y 12 anchos comprobados sin overflow ni consola interna. |
| Competencia | identidad, país y temporada | `/liga/[id]` | config + Supabase | validado | Identidad y temporada reales comprobadas en Liga Profesional y Libertadores. |
| Competencia | fase/jornada actual | `/liga/[id]` | fixture/reglas | validado | Selector de jornada y bloques reales comprobados. |
| Competencia | fixture por fecha/fase | `/liga/[id]` | caché de fixtures | validado | Partidos reales por día/fase, estados y marcador comprobados en caché de solo lectura. |
| Competencia | navegación a partido/equipo | `/liga/[id]` | ids del fixture | implementado | Enlaces reales a partido preservados; navegación a equipo depende de cada componente y requiere pasada específica. |
| Tabla | liga general | `/liga/[id]`, `/tablas` | standings cache | validado | Más de diez filas reales, acceso desde `/tablas` y navegación al ancla comprobados. |
| Tabla | zonas y grupos | `/liga/[id]` | standings/reglas | validado | Zonas de Liga Profesional y ocho grupos de Libertadores comprobados. |
| Tabla | clasificación/promedios/descenso | `/liga/[id]` | standings + reglas locales | validado | Tabla anual, promedios y leyendas de clasificación revisados visualmente con datos reales. |
| Tabla | forma y estados V/E/D | `/liga/[id]` | standings | pendiente | D,C,M,T,X,Ø,A,Q,R |
| Llaves | partido único | `/liga/[id]` | fixtures/reglas | implementado | Cuadro responsive y estados a confirmar comprobados; falta fixture QA finalizado de partido único. |
| Llaves | ida/vuelta y global | `/liga/[id]` | fixtures/series | implementado | Contratos y componentes CONMEBOL preservados; falta serie finalizada específica para validar global. |
| Llaves | penales | `/liga/[id]` | fixtures | implementado | Formateo de penales preservado; falta fixture QA específico. |
| Líderes | goleadores | `/liga/[id]`, `/estadisticas` | caché/API-Football | implementado | Estado vacío honesto validado; el caché de QA no devolvió jugadores. |
| Líderes | asistencias y tarjetas | `/liga/[id]`, `/estadisticas` | caché/API-Football | implementado | Estados vacíos honestos validados; falta dataset con líderes. |
| Competencia | equipos participantes | `/liga/[id]` | fixtures/standings | pendiente | D,C,I,N,M,T,X,Ø,A,Q,R |
| Competencia | noticias e historia | `/liga/[id]` | contenido local/campeones | pendiente | D,I,N,M,T,X,Ø,A,Q,R |
| Campeones | historial | `/liga/[id]/campeones` | tablas locales/Supabase | pendiente | D,C,I,N,M,T,X,L,E,Ø,A,Q,R |
| Competencia | sedes cuando existen | `/liga/[id]` | config/equipos | pendiente | D,C,I,N,M,T,X,Ø,A,Q |
| Competencia | sin fixture/tabla/líderes | `/liga/[id]` | fuente vacía | implementado | Superficies vacías y de error rediseñadas; falta forzar las tres fuentes vacías en E2E. |
| Competencia | variantes Argentina/CONMEBOL/UEFA | `/liga/[id]` | reglas específicas | implementado | Argentina y CONMEBOL validados; UEFA conserva lógica pero requiere pasada visual específica. |

## 5. Mundial 2026

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Mundial | portada integrada al sitio | `/liga/selecciones-mundial` | config + contenido + datos | validado | Datos reales, metadata específica, identidad nueva, navegación contextual, 12 anchos y consola/hidratación limpios en build de producción local. |
| Mundial | partidos y TV | misma | fixtures/broadcasts | implementado | 104 fixtures reales sin duplicados, marcador/penales/estado/sede, equipos, partido y recordatorio validados; el resumen de liga no expone TV y no se inventa. |
| Mundial | grupos y clasificación | misma | standings/reglas | validado | 48 selecciones y 13 tablas, incluida mejores terceros, renderizadas desde caché real; tabs de tabla/partidos preservados. |
| Mundial | llaves reales | misma | fixtures/series | validado | Cuadro oficial y cruces reales visibles, con navegación y estados pendientes preservados. |
| Mundial | simulador | misma | estado local/reglas | implementado | Cambio de tab oficial/simulador, carga del editor y retorno a llaves comprobados sin error de consola; el fixture finalizado no permite validar una edición nueva y su persistencia. |
| Mundial | estadísticas y goleadores | misma | caché/API-Football | implementado | Componente conectado y vacío honesto; el caché de QA no produjo líderes para validar contenido positivo. |
| Mundial | selecciones y jugadores | misma | equipos/planteles | implementado | 48 selecciones reales, logos/fallback y enlaces de equipo validados; jugadores se consultan desde cada selección. |
| Mundial | sedes | misma | config/equipos | validado | Tres países y 16 sedes editoriales visibles; el estadio específico se toma del fixture cuando existe. |
| Mundial | noticias e historia | misma | contenido local/Supabase historial | validado | Seis artículos reales enlazados y 22 campeones/sedes históricas visibles; sin tarjeta editorial simulada. |
| Mundial | favoritos | misma | localStorage | implementado | Favoritos de selecciones preservados en sus fichas y accesibles desde shell; falta una acción directa en portada. |
| Mundial | assets reales/fallback | misma | `public`/remotos | validado | Trofeo local cargado con dimensiones reales, logos mediante `SafeImage`, sin carrusel roto ni error de red interno. |
| Mundial | estados sin datos | misma | fuentes vacías | implementado | Vacíos explícitos para torneo, fixture, grupos, llaves, estadísticas, selecciones y noticias; falta forzar un dataset mundialista totalmente vacío en E2E. |

## 6. Equipos, selecciones y jugadores

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Equipo | identidad, escudo, país | `/equipo/[id]` | Supabase + `/teams` | validado | Boca y Argentina reales; carga prioritaria/fallback, 12 anchos, sin overflow ni errores de consola. |
| Equipo | estadio y entrenador | `/equipo/[id]` | team/venue + lineups cacheadas | validado | Estadio completo y entrenador real de la última lineup disponible; fallback “No sincronizado” preservado. |
| Equipo | competiciones clickeables | `/equipo/[id]` | fixtures/standings | implementado | Cuatro competiciones reales de Boca y enlaces a configuraciones conocidas; falta navegación E2E de cada variante. |
| Equipo | competiciones primero en mobile | `/equipo/[id]` | layout | validado | Orden DOM inmediatamente posterior a la navegación contextual comprobado a 320 y 390 px. |
| Equipo | plantel y jugadores | `/equipo/[id]` | `/players/squads` + `/players` | validado | 38 jugadores reales de Boca, agrupados por posición; navegación dinámica a jugador comprobada. |
| Equipo | forma reciente | `/equipo/[id]` | fixtures | validado | Seis resultados reales, marcador, estado y competencia comprobados. |
| Equipo | próximos partidos | `/equipo/[id]` | fixtures/cache | validado | Seis encuentros reales, fecha Argentina, rivales, estados y enlaces a partido comprobados. |
| Equipo | últimos resultados | `/equipo/[id]` | fixtures/cache | validado | Marcadores y estados finales reales renderizados; estado vacío equivalente implementado. |
| Equipo | estadísticas | `/equipo/[id]` | fixtures calculados | validado | PJ, ganados, empatados, perdidos, GF y GC de los últimos 12 meses calculados desde 27 resultados reales. |
| Equipo | títulos, participaciones y descensos | `/equipo/[id]` | extras locales/cache | implementado | Extras curados existentes visibles para selecciones; clubes y descensos siguen sin fuente completa. |
| Equipo | ranking FIFA de selección | `/equipo/[id]` | extras disponibles | implementado | Panel de ranking/títulos conectado a extras existentes; no se inventa un ranking actual sin fuente sincronizada. |
| Equipo | noticias | `/equipo/[id]` | contenido editorial local | validado | Noticias etiquetadas reales verificadas en Argentina y vacío honesto verificado en Boca. |
| Equipo | favorito | `/equipo/[id]` | localStorage | validado | Agregar, estado `aria-pressed`, persistencia, listado en `/equipos` y eliminación comprobados. |
| Equipo | dato/logo/competición ausente | `/equipo/[id]` | fuentes parciales | implementado | Fallbacks y vacíos honestos conectados; ID inválido corta antes de cualquier llamada al proveedor. |
| Jugador | foto, nombre y nacionalidad | `/jugador/[id]` | Supabase + `/players` | validado | Ficha real de A. Marchesín abierta desde el plantel; foto prioritaria completa y nacionalidad verificadas. |
| Jugador | edad, posición y dorsal | `/jugador/[id]` | `/players`/squad | validado | Edad/posición desde detalle y dorsal real propagado desde el plantel; dorsal 1 comprobado. |
| Jugador | club y selección navegables | `/jugador/[id]` | estadísticas/equipo | implementado | Club real enlazado y validado; la relación separada con selección depende de disponibilidad de fuente. |
| Jugador | estadísticas, goles y asistencias | `/jugador/[id]` | `/players` | validado | Temporada, partidos, titularidades, minutos, valoración, goles y asistencias reales comprobados. |
| Jugador | tarjetas, partidos y competiciones | `/jugador/[id]` | player/event matches | implementado | Tarjetas y competencia conectadas; incidencias muestran lista real o vacío honesto, sin dataset positivo en QA. |
| Jugador | trayectoria | `/jugador/[id]` | datos disponibles | bloqueado | La fuente actual no ofrece historial completo; se muestra el límite de forma explícita y accesible. |
| Jugador | noticias | `/jugador/[id]` | contenido editorial local | implementado | Filtro real por tags/título/resumen y vacío honesto; falta un jugador con artículos positivos para QA. |
| Jugador | información parcial/no encontrado | `/jugador/[id]` | App Router/fuente parcial | implementado | ID inválido validado sin fetch; error y datos parciales tienen superficies honestas, falta forzar timeout real. |

## 7. Noticias, análisis y mercado

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Noticias | portada editorial | `/noticias` | contenido local | validado | Jerarquía editorial nueva, artículo principal y secundarios reales, navegación y 12 anchos comprobados en build de producción local. |
| Noticias | categorías/listado | `/noticias` | contenido local | validado | Filtros por categoría con conteos reales, estado seleccionado y navegación por teclado comprobados; sin duplicar artículos. |
| Artículo | título, bajada e imagen | `/noticias/[slug]` | contenido local | validado | Título, bajada e imagen real o reemplazo editorial explícito verificados a 320 y 1920 px. |
| Artículo | autor, fecha y tiempo de lectura | `/noticias/[slug]` | metadata local | validado | Autor, fecha legible y tiempo calculado renderizados desde metadata real. |
| Artículo | cuerpo y encabezados | `/noticias/[slug]` | contenido local | validado | Cuerpo, secciones, listas, imágenes intermedias y fuentes preservados con jerarquía semántica. |
| Artículo | relacionados y compartir | `/noticias/[slug]` | contenido/share | validado | Relacionados reales y diálogo de compartir comprobados con apertura, foco, cierre y enlace copiable. |
| Artículo | SEO y dato estructurado | `/noticias/[slug]` | metadata/SEO | validado | Metadata existente preservada y `NewsArticle` JSON-LD verificado en el HTML renderizado. |
| Noticias | imagen o listado ausente | noticias | fallback/colección vacía | implementado | Reemplazo sin imagen validado sin solicitudes rotas; el vacío total está implementado pero la colección real actual no permite forzarlo en E2E sin mock. |
| Mercado | listado y categorías | `/mercado-de-pases` | contenido local | validado | Cero movimientos reales se presenta como vacío honesto; filtros por tipo/estado, metodología y 12 anchos validados sin contenido ficticio. |
| Mercado | artículo | `/mercado-de-pases/[slug]` | contenido local | implementado | Detalle tipado listo para un movimiento real y guías metodológicas navegadas; bloque positivo sin validar porque `TRANSFER_MARKET_ITEMS` está vacío. |
| Análisis | listado | `/analisis` | Markdown local | validado | Listado editorial de guías reales, metadata y enlaces comprobados en mobile y desktop. |
| Análisis | guía/artículo | `/analisis/[slug]` | Markdown local | validado | Parser Markdown, encabezados, listas, fuentes, compartir, relacionados, metadata y `Article` JSON-LD comprobados. |

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
| Auth | iniciar sesión | `/login` | Supabase Auth | implementado | UI nueva, campos/autocomplete, estados, redirección segura y 12 anchos validados; acceso positivo bloqueado por ausencia de credencial QA aislada. |
| Auth | registro | `/register` | Supabase Auth + profile | implementado | Validación local anterior a Supabase, estados y responsive validados sin crear usuarios en la base real; alta positiva bloqueada por aislamiento. |
| Auth | recuperación por correo | `/restablecer-contrasena` | Supabase Auth | implementado | Solicitud, recuperación y cambio mantienen contratos reales; email positivo no enviado para evitar una mutación externa, enlace ausente/expirado validado. |
| Auth | callback y redirección | `/auth/callback` | Supabase SSR | implementado | Validación de token/code y `next` seguro preservados; caso inválido comprobado, intercambio positivo requiere enlace QA real. |
| Auth | sesión persistente | todas | cookies Supabase SSR | implementado | Suscripción y lectura SSR/cliente preservadas; sesión positiva no validada por falta de usuario QA aislado. |
| Auth | cerrar sesión | shell/perfil | Supabase Auth | implementado | Acción real preservada en mobile y desktop; falta sesión QA positiva para ejecutarla sin afectar una cuenta real. |
| Auth | ruta protegida y sesión vencida | perfil/privadas/admin | proxy + servidor | pendiente | D,I,N,E,Ø,A,S,Q,R |
| Perfil | datos y preferencias | `/perfil` | profiles/Auth | implementado | UI, tabs, validaciones, switches, carga/error y fallback de columnas opcionales implementados; estado sin sesión y 12 anchos validados, guardado positivo bloqueado por credenciales. |
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
