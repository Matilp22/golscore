# Hay Fulbo: matriz de paridad funcional

Estado del documento: línea de base de Etapa 1
Fecha de corte: 2026-07-30
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
| Shell | navegación contextual por torneo | `/liga/[id]` | configuración de competencia | validado | Anclas dinámicas para partidos, clasificación, llaves, equipos y sedes; interacción y 12 anchos comprobados en competencias reales. |
| Shell | footer y enlaces legales | todas | local | implementado | I,N,M,T,X,A,Q,R |
| Shell | botón volver | rutas de detalle | historial del router | implementado | I,N,M,T,X,A,Q |
| Shell | selector de idioma | todas | cookie/locales | validado | Cookie `hf_locale`, recarga de documento, atributo `lang` y contenido de servidor comprobados en Chromium. |
| Shell | preferencias de audio de torneo | competencias compatibles | localStorage | implementado | Controles reales, preferencia persistente y puente con el perfil preservados; sincronización positiva de cuenta bloqueada sin una credencial QA aislada. |
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
| PWA | prompt de instalación | todas | navegador + localStorage | validado | Listener real del navegador, prompt, aceptación, cierre y persistencia comprobados en Chromium. |
| PWA | opt-in de push | todas | Notification API/VAPID | implementado | Permisos, carga, error, estado no compatible y ausencia de VAPID son honestos; alta positiva bloqueada porque el entorno QA no expone una clave pública ni autoriza notificaciones. |
| PWA | alta/baja de suscripción | `/api/pwa/push-subscriptions` | Supabase | implementado | Contrato, autenticación y errores preservados; no se escribió una suscripción remota sin usuario/dispositivo QA aislado. |
| Juego editorial | Adiviná el futbolista | `/juegos/adivina-el-futbolista` | banco editorial local + logos Supabase | validado | Selección de nivel, foco, respuesta, feedback, pistas, estado deshabilitado, consola y mobile 320 px comprobados sin mutaciones. |

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
| Home | carga, error, offline y timeout | `/` | servidor/red | validado | Skeleton Matchday, datos parciales ante timeout de extras, vacío y recuperación offline comprobados sin exponer errores técnicos. |
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
| Historial | enfrentamientos directos | `/partido/[id]/historial` | caché/head-to-head | validado | Ruta reconstruida con resumen, encuentros reales o vacío honesto, navegación y 12 anchos comprobados en build de producción local. |
| Partido | actualización en vivo | `/partido/[id]` | live sync | implementado | Contrato preservado; endpoint interceptado en QA para impedir escrituras. |
| Partido | loading, error y no encontrado | `/partido/[id]` | App Router | validado | Skeleton, error temporal y partido inexistente diferenciados; ID inválido evita fetch, expone noindex, CTA y 12 anchos sin overflow. |

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
| Tabla | forma y estados V/E/D | `/liga/[id]` | standings | validado | V/E/D incluyen texto y nombre accesible cuando la fuente los entrega; el dataset sin forma muestra “Forma no disponible” sin inventar resultados. |
| Llaves | partido único | `/liga/[id]` | fixtures/reglas | implementado | Cuadro responsive y estados a confirmar comprobados; falta fixture QA finalizado de partido único. |
| Llaves | ida/vuelta y global | `/liga/[id]` | fixtures/series | implementado | Contratos y componentes CONMEBOL preservados; falta serie finalizada específica para validar global. |
| Llaves | penales | `/liga/[id]` | fixtures | implementado | Formateo de penales preservado; falta fixture QA específico. |
| Líderes | goleadores | `/liga/[id]`, `/estadisticas` | caché/API-Football | implementado | Estado vacío honesto validado; el caché de QA no devolvió jugadores. |
| Líderes | asistencias y tarjetas | `/liga/[id]`, `/estadisticas` | caché/API-Football | implementado | Estados vacíos honestos validados; falta dataset con líderes. |
| Competencia | equipos participantes | `/liga/[id]` | fixtures/standings | validado | Identidades reales deduplicadas, más de diez enlaces de equipo y presentación responsive comprobados en Liga Profesional. |
| Competencia | noticias e historia | `/liga/[id]` | contenido local/campeones | implementado | Historia de campeones real y accesible validada; noticias se muestran sólo en competiciones con fuente editorial disponible, sin tarjetas simuladas. |
| Campeones | historial | `/liga/[id]/campeones` | tablas locales/Supabase | validado | Palmarés, ranking y 22 finales mundialistas reales comprobados con navegación, SEO, consola y 12 anchos. |
| Competencia | sedes cuando existen | `/liga/[id]` | fixtures | validado | Sedes y ciudades se derivan de fixtures reales, se deduplican y se ocultan sólo cuando la fuente no las publica. |
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
| Prode | portada/listado de partidos | `/prode` | API propia + Supabase | validado | Copa del Mundo 2026, fase Final y partido España–Argentina cargados desde las fuentes existentes; navegación única, consola limpia y 12 anchos comprobados. |
| Prode | filtros de partidos | `/prode` | estado cliente | validado | Selects nativos etiquetados de liga y fecha/fase; selección inicial real, teclado y responsive 320–1920 px comprobados. |
| Prode | formulario de pronóstico | `/prode` | API/Supabase autenticado | implementado | Inputs, validación, borrador y guardado real preservados; guardado positivo bloqueado por ausencia de una cuenta QA aislada y por no mutar predicciones reales. |
| Prode | bloqueo por horario/estado | `/prode` | reglas + fixture | validado | Final real renderizada con controles deshabilitados y acción “Bloqueado”; regla temporal existente preservada. |
| Prode | pronóstico persistido | `/prode` | predictions | implementado | Lectura y actualización posterior al guardado conectadas al contrato existente; persistencia positiva bloqueada sin credencial QA aislada. |
| Prode | puntaje y explicación | `/prode` | scores/results | validado | Resumen de puntos/predicciones/exactos y reglas 3/1/0 visibles y responsive; estado sin puntos comprobado. |
| Prode | ranking | `/prode` | leaderboard | validado | Endpoint real total/por fecha completa la carga y presenta el vacío correcto sin errores de consola. |
| Prode | grupos Mundial | `/prode` | endpoint world-cup-groups | implementado | Selector y tabla condicional preservados; el dataset de QA abrió la Final y no permitió validar una fase de grupos positiva. |
| Prode privado | lista, búsqueda y creación | `/prode/torneos` | Supabase/API propia | implementado | Estado sin sesión, shell nuevo, navegación y responsive validados; listado, búsqueda y creación positivos bloqueados sin cuenta QA aislada. |
| Prode privado | detalle y miembros | `/prode/torneos/[id]` | Supabase/API propia | implementado | Contratos, permisos y rutas preservados; validación positiva bloqueada sin membresía QA. |
| Prode privado | invitación/aceptar/revocar | invitación/detalle | Supabase/API propia | implementado | Acciones reales preservadas; no se emitieron ni revocaron invitaciones sobre datos reales durante QA. |
| Prode privado | solicitud/aprobar/rechazar | detalle | Supabase/API propia | implementado | Flujos y estados existentes preservados; validación positiva requiere dos identidades QA aisladas. |
| Prode privado | chat y eliminación | detalle | Supabase/API propia | implementado | UI y API existentes preservadas; escrituras y eliminación bloqueadas deliberadamente por aislamiento. |
| Prode | sesión ausente/vencida | todas Prode | Supabase Auth | validado | Carga de sesión y mensaje honesto sin usuario comprobados en `/prode/torneos`, sin requests de escritura. |

## 9. Mi Torneito

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Mi Torneito | portada sin datos ficticios | `/mi-torneito` | contenido local + Supabase real | validado | Hero nuevo muestra el conteo y último torneo del repositorio; se eliminaron partido, equipos y tabla hardcodeados. Capturas y 12 anchos comprobados. |
| Mi Torneito | listado de torneos | `/mi-torneito/torneos` | repositorio Supabase | validado | Torneo publicado real y enlace dinámico comprobados; estado vacío honesto implementado. |
| Mi Torneito | solicitud de torneo | `/mi-torneito/solicitar` | Supabase | implementado | Campos, límites, errores y acción real preservados; formulario no enviado para no crear una solicitud en la base real. |
| Torneo | identidad y navegación | `/mi-torneito/t/[tournamentSlug]` | Supabase | validado | Apertura del slug publicado, identidad, secciones y regreso comprobados. |
| Torneo | fixture y fechas | misma | rounds/matches | validado | Lista real o vacío por fuente renderizados; enlace a detalle comprobado cuando existió partido. |
| Torneo | resultados | misma | matches | validado | Marcador y estado salen del repositorio y el detalle conserva fecha/sede/transmisión. |
| Torneo | tabla | misma | partidos calculados/datos | validado | Tabla calculada o vacío explícito visible en el torneo publicado, sin datos de demostración en UI. |
| Torneo | equipos y planteles | torneo/equipo | teams | implementado | Grilla y detalle de equipo conectados; no existe modelo de planteles individuales en el contrato actual. |
| Torneo | goleadores | misma | partidos/eventos disponibles | bloqueado | El contrato actual no expone eventos ni jugadores goleadores. La propuesta separada está documentada en `docs/redesign/data-change-proposals.md`; no se ejecutó ninguna migración, política ni escritura. |
| Torneo | detalle de partido | `/mi-torneito/t/[tournamentSlug]/p/[matchId]` | matches | validado | Ruta dinámica, heading accesible, marcador e información real comprobados cuando hubo partido publicado. |
| Torneo | detalle de equipo | `/mi-torneito/t/[tournamentSlug]/e/[teamSlug]` | teams/matches | validado | Ruta dinámica, identidad, campaña y fixture comprobados cuando hubo equipo publicado. |
| Organizador | acceso por permiso | `/mi-torneito/admin` | Auth/admin assignments | validado | Estado sin sesión, explicación, CTA real y 12 anchos comprobados sin inventar asignaciones. Acceso positivo requiere una cuenta QA con torneo asignado. |
| Organizador | carga y edición | `/mi-torneito/admin` | repositorio Supabase | implementado | Formularios y server actions existentes preservados e integrados al sistema nuevo; no se escribieron equipos, fixtures ni resultados reales durante QA. |
| Organizador | confirmaciones y errores | `/mi-torneito/admin` | estado de mutación | implementado | Feedback y retornos preservados; caso positivo bloqueado por ausencia de identidad QA asignada. |
| Mi Torneito | sin torneos/sin datos | todas | colecciones vacías | implementado | Vacíos específicos para portada, listado, fixture, tabla, equipos y campaña; la fuente QA contenía un torneo y no permitió validar el vacío global en runtime. |

## 10. Autenticación, perfil y administración

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| Auth | iniciar sesión | `/login` | Supabase Auth | implementado | UI nueva, campos/autocomplete, estados, redirección segura y 12 anchos validados; acceso positivo bloqueado por ausencia de credencial QA aislada. |
| Auth | registro | `/register` | Supabase Auth + profile | implementado | Validación local anterior a Supabase, estados y responsive validados sin crear usuarios en la base real; alta positiva bloqueada por aislamiento. |
| Auth | recuperación por correo | `/restablecer-contrasena` | Supabase Auth | implementado | Solicitud, recuperación y cambio mantienen contratos reales; email positivo no enviado para evitar una mutación externa, enlace ausente/expirado validado. |
| Auth | callback y redirección | `/auth/callback` | Supabase SSR | implementado | Validación de token/code y `next` seguro preservados; caso inválido comprobado, intercambio positivo requiere enlace QA real. |
| Auth | sesión persistente | todas | cookies Supabase SSR | implementado | Suscripción y lectura SSR/cliente preservadas; sesión positiva no validada por falta de usuario QA aislado. |
| Auth | cerrar sesión | shell/perfil | Supabase Auth | implementado | Acción real preservada en mobile y desktop; falta sesión QA positiva para ejecutarla sin afectar una cuenta real. |
| Auth | ruta protegida y sesión vencida | perfil/privadas/admin | proxy + servidor | validado | `/admin` cerró el acceso server-side sin cargar herramientas; `/mi-torneito/admin` mostró acceso requerido. Sesión vencida positiva requiere cookie QA controlada. |
| Perfil | datos y preferencias | `/perfil` | profiles/Auth | implementado | UI, tabs, validaciones, switches, carga/error y fallback de columnas opcionales implementados; estado sin sesión y 12 anchos validados, guardado positivo bloqueado por credenciales. |
| Admin | login separado | `/admin/login` | Supabase Auth | validado | Experiencia editorial privada, noindex, estado de configuración, responsive 320–1920 px y consola comprobados; formulario positivo no disponible porque el entorno QA no define ADMIN_EMAILS. |
| Admin | control `ADMIN_EMAILS` | `/admin/*` | servidor | validado | Fail-closed comprobado: `/admin` devolvió “Admin no configurado” y no montó el shell ni consultó herramientas. |
| Admin | dashboard | `/admin` | servicios admin | implementado | Shell, métricas, salud y accesos rápidos adoptan el sistema nuevo; lectura positiva bloqueada por guard sin ADMIN_EMAILS. |
| Admin | anuncios | `/admin/ads` | admin_ad_slots | implementado | Formularios, acciones y permisos preservados dentro de cards/inputs nuevos; CRUD positivo no ejecutado. |
| Admin | TV | `/admin/broadcasts` | reglas/overrides | implementado | Búsqueda, edición, activación y reglas preservadas con presentación nueva; escrituras bloqueadas durante QA. |
| Admin | destacados | `/admin/featured-matches` | featured matches | implementado | Contratos, tabla y acciones preservados en el shell nuevo; validación autenticada pendiente de cuenta QA admin. |
| Admin | partidos | `/admin/matches` | matches/overrides | implementado | Editor completo conserva campos, estados y server actions; no se alteraron partidos reales. |
| Admin | sincronización | `/admin/sync` | handlers admin | implementado | Formularios manuales y estado de caché preservados; no se disparó ningún sync. |
| Admin | visibilidad | `/admin/visibility` | visibility rules | implementado | Alta/edición y activación preservadas; no se modificaron reglas reales. |
| Admin | Mi Torneito | `/admin/mi-torneito/*` | tablas Mi Torneito | implementado | Resumen, solicitudes, torneos y detalle heredan navegación, cards, tablas y formularios nuevos; flujo positivo bloqueado por guard. |

## 11. Plataforma, SEO, anuncios y estados transversales

| Módulo | Funcionalidad actual | Ruta | Fuente de datos | Estado nuevo | Validación |
| --- | --- | --- | --- | --- | --- |
| SEO | title y description | públicas | metadata API | validado | Home, Noticias y Mi Torneito exponen descripción no vacía; 404 y admin tienen títulos/estados propios. |
| SEO | canonical | públicas | `SITE_URL` | validado | Canonical exacto por pathname comprobado en Home, Noticias y Mi Torneito. |
| SEO | Open Graph/Twitter | públicas | metadata/contenido | validado | `og:title` y `twitter:card` comprobados en tres familias de página; cards editoriales verificadas en su suite. |
| SEO | datos estructurados | contenido/deporte | builders locales | validado | JSON-LD de artículo y contenido editorial comprobado por la suite editorial; builders existentes preservados. |
| SEO | sitemap y robots | `/sitemap.xml`, `/robots.txt` | rutas/contenido | validado | Respuesta real comprobada; sitemap incorpora secciones públicas y excluye admin/perfil, robots bloquea `/admin`. |
| SEO | enlaces internos/headings | públicas | UI | validado | Un H1, un landmark main final, enlaces nombrados, IDs únicos e imágenes con alt auditados en páginas representativas; suites de módulo cubren navegación interna. |
| SEO | alias/redirecciones | legacy | App Router | validado | `/contact`, `/privacy-policy` y `/terms` redirigen a sus rutas canónicas actuales. |
| Ads | script y cuenta | todas habilitadas | env/config | validado | Meta de cuenta y script afterInteractive comprobados; Auth no renderiza slot. Publisher preservado sin tocar configuración productiva. |
| Ads | slot sin CLS | rutas habilitadas | admin/env | implementado | Slot reserva 120 px y muestra etiqueta accesible; el entorno local no define `NEXT_PUBLIC_ADSENSE_DISPLAY_SLOT_ID`, por lo que falta runtime positivo. |
| Analítica | Google Analytics | todas | env/script | implementado | Carga condicional y page views preservados; `NEXT_PUBLIC_GA_MEASUREMENT_ID` no está disponible en el entorno local para prueba positiva. |
| Analítica | Vercel Analytics | todas | Vercel | implementado | Componente oficial preservado en layout; validación runtime pendiente del Preview de Vercel. |
| Observabilidad | Sentry | errores | Sentry config | implementado | Captura preservada en error segmentado y global; no se provocó una excepción real para evitar enviar ruido a observabilidad. |
| Error | error global recuperable | todas | App Router/Sentry | implementado | Pantalla nueva con reintento, regreso, referencia y captura; no se forzó un fallo raíz real. |
| Error | error segmentado | módulos de datos | App Router | implementado | Boundary raíz de aplicación agregado con reset y navegación, manteniendo el shell; prueba positiva destructiva no necesaria. |
| Error | 404 de producto | ruta inexistente | App Router | validado | Status 404, metadata restrictiva `noindex`, diseño nuevo, enlaces, consola esperada y 12 anchos comprobados. |
| Estado | skeletons consistentes | páginas de datos | loading.tsx/componentes | validado | Root, competencia, partido, equipo y jugador usan skeletons Matchday; auditoría espera y confirma su retirada antes de validar landmarks. |
| Estado | offline y timeout | páginas interactivas | navegador/red | validado | Corte de red simulado en búsqueda produce mensaje útil sin `Failed to fetch`; Home conserva fallback de datos parciales ante timeout de extras. |
| Estado | sesión vencida/permiso insuficiente | protegidas | Auth/permisos | validado | Perfil, Prode privado, organizador y admin presentan estados honestos; admin cierra acceso si falta configuración. |
| Assets | logo/foto/imagen ausente | todas | fallback local | validado | Fallbacks de escudo, foto e imagen faltante comprobados en entidades/editorial sin romper layout. |
| Responsive | sin overflow ni solapamiento | todas | CSS/layout | validado | Módulos principales y rutas secundarias comprobados en 320, 360, 390, 412, 430, 768, 820, 1024, 1280, 1366, 1440 y 1920 px; la suite cubre tablas, cards, modales, formularios y estados. |
| Accesibilidad | landmarks y jerarquía | todas | HTML | validado | Auditoría DOM exige un único main final, al menos un H1, IDs únicos, alt y nombres accesibles; se corrigieron landmarks anidados en admin. |
| Accesibilidad | foco visible y orden | todas | HTML/CSS | validado | Búsqueda, favoritos, notificaciones, navegación y formularios tienen foco/teclado comprobados; selectores Prode reemplazados por controles nativos. |
| Accesibilidad | reduced motion | todas | CSS/cliente | validado | Media query reduce animaciones/transiciones y `scroll-behavior`; comportamiento computado comprobado en Chromium. |
| Performance | imágenes y LCP | públicas | Next Image/assets | implementado | Componentes de assets preservan optimización/fallback y heroes evitan dependencias pesadas; medición final queda para Preview. |
| Performance | bundle e hidratación | todas | RSC/client boundaries | implementado | Build de 83 páginas, componentes servidor preservados y límites cliente acotados; falta medición final del deployment. |
| Seguridad | secretos solo servidor | todas | env/server-only | validado | 131 archivos cambiados inspeccionados: 0 nombres prohibidos, 0 `.env`, 0 patrones de secreto literal y 0 cambios bajo `supabase/`. |
| Seguridad | producción/Supabase intactos | infraestructura | Git/Vercel/Supabase | validado | Rama remota exclusiva y Preview con `target: null` verificados; `main` y el deployment productivo conservaron el commit `5695513c`; no hubo migraciones, RLS, DNS, dominios ni deploy productivo. |

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
