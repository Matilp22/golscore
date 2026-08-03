# Auditoría de directrices por área — 2026-08-03

Rama: `codex/hay-fulbo-redesign-complete-preview-v2`

Objetivo de esta pasada: volver a leer el pedido funcional grande, separar las
directrices que estaban mezcladas y contrastarlas contra la implementación
real antes de actualizar el Preview.

## Hallazgo transversal

La auditoría visual del Preview anterior encontró un falso positivo de QA. A
390 px, el documento no informaba scroll horizontal porque el shell lo
ocultaba, pero los módulos internos de competencia excedían su contenedor:

- Premier League: contenido visible de 376 px, tarjeta de fecha de 5.051 px;
- Libertadores: contenido visible de 376 px, módulos de 14.087 px;
- el resultado era información recortada, grupos aparentemente ausentes y
  equipos/textos fuera de pantalla.

La causa era una columna implícita de CSS Grid con tamaño mínimo intrínseco. La
corrección fija una única columna `minmax(0, 1fr)`, acota cada módulo y agrega
una validación que mide el rectángulo de cada hijo. El test ya no considera
válido un contenido ancho sólo porque el `body` oculte el overflow.

## Matriz de modificaciones por área

| Área | Directriz consolidada | Estado de esta pasada | Evidencia / límite |
| --- | --- | --- | --- |
| Navegación mobile | Inicio, Competiciones, Buscar, Favoritos y Más; eliminar el acceso redundante Partidos | aplicado | `src/frontend/navigation/app-navigation.ts` |
| Menú Más | quitar Mundial 2026 y el bloque regional de competiciones | aplicado | `MORE_NAVIGATION` no contiene ninguno de los dos bloques |
| Marca | usar el wordmark textual nuevo y no el logo de imagen anterior | aplicado | shell global compartido |
| Home | ordenar siempre por horario, incluso finalizados; no priorizar estados al ordenar | aplicado | `compareEntries` compara la fecha real ascendente |
| Home | mantener datos, enlaces, TV, incidencias, favoritos y ausencia honesta | aplicado; revalidación pendiente de Preview | componentes `home/matchday` con datos reales |
| Competencias | orden visible y estructural Clasificación → Partidos → Llaves | corregido | el JSX ya sigue el orden y el CSS queda como respaldo |
| Liga Profesional | una tarjeta con selector Grupo A / Grupo B; forma sólo allí; luego fecha, llave, anual, promedios, equipos, sedes y líderes | aplicado; revalidación pendiente | `CompetitionGroupSwitcher`, tablas secundarias y orden de secciones |
| Forma | V/E/D como ✓, –, × con texto accesible; no mostrarla en anual/promedios argentinos | aplicado | `StandingsTable`; `showForm` se limita a zonas A/B para Liga Profesional |
| Tablas mobile | grupos, anual, promedios y líderes deben entrar sin barra horizontal | corregido; revalidación pendiente | tablas `fitNarrow`, columna acotada y test de `scrollWidth` por tabla |
| Llaves mobile | único bloque deportivo autorizado a desplazarse horizontalmente | aplicado | `hf-bracket-scroll` / `bracket-scroll` |
| CONMEBOL | grupos con Tabla/Partidos, agenda y llaves; quitar superficies oscuras anteriores | corregido | se conserva la lógica de series y se reemplaza la piel oscura por tokens del sistema |
| UEFA | fase liga, partidos y eliminación en el orden correcto; corregir superposiciones | corregido | Champions, Europa y Conference comparten la familia `uefa-league-phase` |
| Otras ligas | no forzar formato de copa o zonas; conservar liga simple, grupos o eliminación según datos/reglas | aplicado; revalidación por familia pendiente | atributo `data-competition-family` y reglas existentes |
| Equipos y sedes en copas | mostrar riel horizontal compacto, no listas gigantes | corregido | sólo familias CONMEBOL, UEFA y eliminación |
| Líderes | cards compactas y máximo 10 para goleadores, asistencias y tarjetas | aplicado | `LeaderListInteractive` |
| Favoritos de competencia | estrella en cabecera y catálogo | aplicado | `FavoriteCompetitionButton` |
| Detalle de partido | cabecera simétrica y compacta; minuto sin recuadro; estadística con label sobre barra y valores laterales | aplicado; revalidación pendiente | reglas finales en `redesign-v2.css` y datos existentes preservados |
| Equipo / selección | cabecera antes que actividad; competiciones inmediatamente debajo en mobile | aplicado | orden DOM de `/equipo/[id]` |
| Prode | quitar acceso y opción activa del Mundial terminado; Liga Profesional por defecto | corregido | se filtra Mundial sólo en la UI; el contrato histórico no se elimina |
| Prode | quitar el bloque redundante de aciertos exactos de la cabecera/resumen | corregido | resumen reducido a puntos y pronósticos; reglas permanecen abajo |
| Avatar de club | elegir escudo en perfil y mostrarlo junto a la identidad del usuario | parcialmente aplicado | funciona para el usuario autenticado vía `user_metadata`; mostrarlo para otros usuarios en rankings requeriría exponer un campo compartido y no se cambia esquema/RLS sin autorización |
| Mi Torneito | buscador de torneos primero y “Cómo funciona” como pantalla separada | aplicado | `MiTorneitoUtilityLanding` y `/mi-torneito/como-funciona` |
| Noticias | hero compacto sin métricas; filtro por liga; inicio cronológico | aplicado | `/noticias` |
| Estadísticas | seleccionar liga sin redirigir a tablas; no inventar agregados | aplicado con límite honesto | el panel informa que la agregación está pendiente porque la fuente actual es por partido |
| Mercado de pases | hero compacto, sin métricas y con contraste correcto | aplicado; revalidación pendiente | `/mercado-de-pases` y tokens editoriales |
| Datos | no mocks, no nuevos fetches innecesarios, no cambios de contrato | preservado | esta pasada reutiliza fixtures, standings, leaders y caché existentes |
| Supabase | no migraciones, RLS, grants, triggers ni escrituras remotas | preservado | no hay cambios bajo `supabase/` |
| Vercel | sólo rama y Preview, nunca producción | pendiente hasta cierre de QA | el push se hará después de lint, typecheck, build y E2E |

## Familias de competencia auditadas

| Familia | Representantes mínimos | Estructura esperada |
| --- | --- | --- |
| Zonas argentinas | Liga Profesional | Grupo A/B, fecha, llave, anual/promedios |
| Liga simple | Premier, La Liga, Serie A, Bundesliga, Ligue 1, Brasileirão y equivalentes | tabla general, fecha, participantes, sedes, líderes |
| Grupos | Copa América y Eurocopa | grupos compactos con Tabla/Partidos, agenda y eliminación cuando exista |
| CONMEBOL | Libertadores y Sudamericana | grupos, agenda por fase, llaves de ida/vuelta |
| Fase liga UEFA | Champions, Europa League y Conference | tabla única, jornadas y llaves |
| Eliminación directa | Copa Argentina, FA Cup, Copa del Rey, Coppa Italia, DFB Pokal y equivalentes | agenda y llave desplazable, sin tabla artificial |
| Ascenso / zonas | Primera Nacional, B Metro, Federal A y equivalentes | conservar grupos/tablas reales publicados por la fuente |

## Límites que no se ocultan

1. Los agregados avanzados de `/estadisticas` no se publican hasta tener una
   consolidación real y cobertura controlada; no se muestran cifras ficticias.
2. El escudo del usuario está persistido en metadata de Auth para su propia
   sesión. Propagarlo a todos los participantes de rankings exige un contrato
   público/compartido adicional; queda documentado, no se ejecuta una
   migración.
3. Estados deportivos sin datos (formación, estadísticas, líderes, sedes) se
   representan como ausencia real y no se completan con mocks.

## Verificación de esta pasada

- `lint`: aprobado.
- `typecheck`: aprobado.
- `build`: aprobado con Next.js 16.2.12; 84 páginas generadas.
- verificadores de lecturas públicas, calidad editorial y llave mundialista:
  aprobados.
- familias representativas (Liga Profesional, Premier League, Libertadores,
  Champions, Copa Argentina y Copa América): aprobadas en mobile.
- las 49 configuraciones visibles de torneo aprobaron la medición responsive
  en dos tramos controlados (25 + 24 rutas).
- la corrida E2E general terminó con 43 pruebas aprobadas y 10 fallidas durante
  episodios de `ERR_INTERNET_DISCONNECTED` / `ERR_NETWORK_CHANGED`; esas fallas
  no se ocultan ni se reinterpretan como validación funcional. No se repitió el
  recorrido masivo para evitar más carga sobre la conexión.
- el enlace Partidos de Liga Profesional y su estado vacío quedan disponibles
  aun cuando la fuente de la fecha falle temporalmente.
