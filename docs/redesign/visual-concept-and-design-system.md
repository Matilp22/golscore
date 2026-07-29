# Hay Fulbo: concepto visual y sistema de diseño

Estado: Etapas 3 y 4 definidas  
Versión: HF Matchday 1.0  
Fecha: 2026-07-29

## 1. Concepto: “Tribuna de papel”

Hay Fulbo debe sentirse como la edición viva de un día de fútbol: la claridad
de una página deportiva, la tensión de un tablero y la cercanía de la cancha.

El lenguaje combina:

- fondo cálido de papel, no blanco clínico;
- tinta azul muy oscura para jerarquía y confianza;
- coral para acciones y momentos de atención;
- teal para navegación contextual e información;
- verde de marca usado con moderación;
- números tabulares y reglas editoriales para resultados;
- superficies mayormente planas, con bordes útiles y pocas sombras;
- fotografía y escudos como protagonistas, sin fondos temáticos invasivos.

No se reutilizan la interfaz oscura/verde actual, sus cards flotantes, su
sidebar, su escala de radios ni los subsistemas visuales de Mundial/Prode. No
se reutiliza Nova. La continuidad de producto está en la marca, los datos y
las URLs, no en la composición anterior.

### Señales futboleras propias

- marcador tratado como dato editorial, no como widget de dashboard;
- líneas cortas que recuerdan marcación de cancha;
- metadatos compactos similares a una ficha de partido;
- números con ancho tabular;
- badges de estado con texto e icono, nunca solo color;
- divisores y ritmo vertical antes que una colección de cards.

No se usan césped fotográfico, gradientes neón, patrones constantes de cancha
ni trofeos decorativos. La identidad deportiva nace de los datos reales.

## 2. Principios

1. **El marcador manda.** Estado, equipos, resultado y tiempo tienen la mayor
   legibilidad.
2. **Densidad con aire.** No se elimina información; se agrupa y se revela en
   el orden correcto.
3. **Una sola voz.** Sitio, Mundial, noticias, Prode, Mi Torneito, Auth y admin
   comparten tokens y primitivas.
4. **Estado explícito.** Color siempre acompañado por texto, forma o icono.
5. **Mobile es la forma base.** Desktop amplía relaciones, no infla tamaños.
6. **Datos opcionales son normales.** Un ausente tiene tratamiento de
   producto y no aparenta un error.
7. **Movimiento sobrio.** Solo confirma jerarquía, cambio o tiempo real.
8. **Acciones reales.** Un control visual siempre ejecuta una capacidad o
   comunica que no está disponible.

## 3. Tokens de color

Los nombres semánticos son la API. Los componentes no deben consumir hex
directos.

### Base y superficies

| Token CSS | Valor | Uso |
| --- | --- | --- |
| `--hf-color-canvas` | `#F2EFE7` | fondo global cálido |
| `--hf-color-canvas-subtle` | `#EAE6DC` | sección alternada |
| `--hf-color-surface` | `#FFFEFA` | contenido principal |
| `--hf-color-surface-raised` | `#FFFFFF` | popover/dialog |
| `--hf-color-surface-sunken` | `#EDEAE2` | control o celda secundaria |
| `--hf-color-surface-inverse` | `#10242F` | marcador/header inverso |
| `--hf-color-ink` | `#10242F` | texto principal |
| `--hf-color-ink-soft` | `#354951` | texto secundario fuerte |
| `--hf-color-ink-muted` | `#5D6A70` | metadata |
| `--hf-color-ink-inverse` | `#FFFDF7` | texto sobre tinta |
| `--hf-color-line` | `#D5D4CC` | divisores |
| `--hf-color-line-strong` | `#A9AFAC` | bordes de control |
| `--hf-color-scrim` | `rgba(9, 26, 34, .58)` | backdrop |

### Marca y acciones

| Token CSS | Valor | Uso |
| --- | --- | --- |
| `--hf-color-primary` | `#B83A2F` | CTA principal coral |
| `--hf-color-primary-hover` | `#9F2D25` | hover |
| `--hf-color-primary-active` | `#85251F` | pressed |
| `--hf-color-primary-soft` | `#F7DDD8` | fondo de selección coral |
| `--hf-color-secondary` | `#006B67` | acción/contexto teal |
| `--hf-color-secondary-hover` | `#005753` | hover |
| `--hf-color-secondary-soft` | `#D7EFEB` | fondo informativo |
| `--hf-color-brand-green` | `#2F7D4A` | marca y detalles limitados |
| `--hf-color-brand-green-soft` | `#DDEBDD` | detalle de marca |
| `--hf-color-focus` | `#0068D6` | anillo de foco |
| `--hf-color-disabled-bg` | `#E4E2DB` | fondo disabled |
| `--hf-color-disabled-ink` | `#7B8283` | texto disabled |

### Estados de partido y resultado

| Token CSS | Valor | Estado | Señal no cromática |
| --- | --- | --- | --- |
| `--hf-color-live` | `#B42318` | en vivo | punto + “EN VIVO” + minuto |
| `--hf-color-finished` | `#46545A` | finalizado | check + “FINAL” |
| `--hf-color-scheduled` | `#2D607A` | programado | reloj + hora |
| `--hf-color-suspended` | `#7C4A03` | suspendido | pausa + texto |
| `--hf-color-postponed` | `#70436F` | postergado | calendario + texto |
| `--hf-color-cancelled` | `#6F3940` | cancelado | equis + texto |
| `--hf-color-win` | `#246B38` | victoria | “V” |
| `--hf-color-draw` | `#5E6669` | empate | “E” |
| `--hf-color-loss` | `#A8322B` | derrota | “D” |

Cada color de estado tiene un fondo derivado entre 8% y 14% de opacidad o una
versión `-soft` calculada/centralizada. No se reduce la opacidad del texto.

### Feedback

| Token CSS | Valor | Uso |
| --- | --- | --- |
| `--hf-color-success` | `#246B38` | operación correcta |
| `--hf-color-success-soft` | `#E0EFE3` | fondo |
| `--hf-color-warning` | `#8A5200` | advertencia |
| `--hf-color-warning-soft` | `#F8E8C8` | fondo |
| `--hf-color-danger` | `#B42318` | error/destructivo |
| `--hf-color-danger-soft` | `#F8DEDA` | fondo |
| `--hf-color-info` | `#205F86` | información |
| `--hf-color-info-soft` | `#DCEBF4` | fondo |

## 4. Tipografía

No se incorpora una dependencia de fuentes. Se usan stacks locales para
evitar bloqueo de render, descarga externa y variación de build:

```css
--hf-font-body: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;
--hf-font-editorial: Georgia, Cambria, "Times New Roman", serif;
--hf-font-data: ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono",
  monospace;
```

- `body`: navegación, controles, nombres y tablas;
- `editorial`: display, títulos de página y titulares de noticias;
- `data`: marcador, minuto, posición, puntos y estadísticas. Siempre
  `font-variant-numeric: tabular-nums`.

### Escala

| Token | Mobile | Desktop | Línea | Uso |
| --- | ---: | ---: | ---: | --- |
| `--hf-type-display` | 32 px | 48 px | 1.02 | portada puntual |
| `--hf-type-page` | 28 px | 36 px | 1.08 | título de página |
| `--hf-type-score` | 36 px | 52 px | .95 | marcador |
| `--hf-type-section` | 21 px | 24 px | 1.18 | sección |
| `--hf-type-subtitle` | 18 px | 20 px | 1.25 | bloque |
| `--hf-type-body` | 16 px | 16 px | 1.55 | cuerpo |
| `--hf-type-body-small` | 14 px | 14 px | 1.45 | soporte |
| `--hf-type-label` | 13 px | 13 px | 1.25 | label/control |
| `--hf-type-meta` | 12 px | 12 px | 1.35 | metadata |
| `--hf-type-overline` | 11 px | 11 px | 1.2 | categoría |

Peso:

- 400 cuerpo;
- 550/600 navegación, labels y metadata importante;
- 700 títulos sans y datos;
- 800 solo marcador/CTA cuando aporta;
- serif 700 para titulares.

Nombres de equipos/jugadores usan sans, permiten dos líneas donde el contexto
lo soporte y nunca bajan de 14 px para “hacerlos entrar”.

## 5. Espaciado, tamaño y ritmo

Escala única:

| Token | Valor |
| --- | ---: |
| `--hf-space-0` | 0 |
| `--hf-space-1` | 4 px |
| `--hf-space-2` | 8 px |
| `--hf-space-3` | 12 px |
| `--hf-space-4` | 16 px |
| `--hf-space-5` | 20 px |
| `--hf-space-6` | 24 px |
| `--hf-space-8` | 32 px |
| `--hf-space-10` | 40 px |
| `--hf-space-12` | 48 px |
| `--hf-space-16` | 64 px |
| `--hf-space-20` | 80 px |

Reglas:

- gutter mobile: 12 px a 320; 16 px desde 360;
- gutter tablet: 24 px;
- gutter desktop: 32 px;
- gap de lista densa: 0 con divisores;
- gap de grupos: 24–32 px;
- medida de lectura: `min(100%, 72ch)`;
- objetivo táctil mínimo: 44 × 44 px;
- icon button estándar: 44 px; compacto solo en tablas desktop y nunca menor
  a 36 px.

## 6. Forma, bordes y elevación

### Radios

| Token | Valor | Uso |
| --- | ---: | --- |
| `--hf-radius-xs` | 3 px | indicador, progreso |
| `--hf-radius-sm` | 7 px | input, botón, celda |
| `--hf-radius-md` | 12 px | panel/card |
| `--hf-radius-lg` | 18 px | dialog/sheet |
| `--hf-radius-pill` | 999 px | badge/chip |

El diseño evita aplicar `lg` a todas las superficies. Listas de partidos usan
un contenedor y divisores; no una tarjeta redonda por partido.

### Bordes

- fino: 1 px `line`;
- énfasis/control: 1 px `line-strong`;
- activo contextual: 2 px `secondary`;
- foco: 3 px `focus` con offset 2 px;
- estado vivo: línea lateral 3 px más badge textual.

### Sombras

| Token | Valor | Uso |
| --- | --- | --- |
| `--hf-shadow-1` | `0 1px 2px rgba(16,36,47,.08)` | control elevado |
| `--hf-shadow-2` | `0 8px 24px rgba(16,36,47,.12)` | popover |
| `--hf-shadow-3` | `0 18px 52px rgba(16,36,47,.20)` | dialog/sheet |

Las superficies de contenido normal no necesitan sombra.

## 7. Layout, breakpoints y densidad

| Nombre | Inicio | Uso |
| --- | ---: | --- |
| `xs` | 320 px | mínimo soportado |
| `sm` | 360 px | mobile común |
| `md` | 768 px | tablet |
| `lg` | 1024 px | tablet grande |
| `xl` | 1280 px | navegación desktop completa |
| `2xl` | 1440 px | aire exterior |
| `wide` | 1920 px | límite de expansión |

- `--hf-layout-max: 1280px`;
- `--hf-layout-reading: 72ch`;
- `--hf-layout-aside: 320px`;
- `--hf-layout-header-mobile: 56px`;
- `--hf-layout-header-desktop: 108px`;
- `--hf-layout-bottom-nav: 64px`;
- densidad normal: fila de partido 72–84 px;
- densidad compacta: tabla/admin 44–52 px;
- los datos no se estiran indefinidamente después de 1280 px.

Los breakpoints se declaran una vez en CSS/configuración. Un componente puede
usar container queries si su adaptación depende del contenedor y no del
viewport.

## 8. Opacidad y capas

Opacidad:

- disabled: 1 para texto con color dedicado; no `.4` genérico;
- overlay hover: 6%;
- overlay active: 12%;
- skeleton base: `surface-sunken`;
- imagen secundaria: 80% solo si no contiene información.

Z-index:

| Token | Valor |
| --- | ---: |
| `--hf-z-base` | 0 |
| `--hf-z-sticky` | 20 |
| `--hf-z-header` | 30 |
| `--hf-z-bottom-nav` | 40 |
| `--hf-z-popover` | 60 |
| `--hf-z-scrim` | 70 |
| `--hf-z-sheet` | 80 |
| `--hf-z-dialog` | 90 |
| `--hf-z-toast` | 100 |

No se agregan `z-index` arbitrarios fuera de la escala.

## 9. Movimiento

| Token | Valor |
| --- | --- |
| `--hf-duration-fast` | 120 ms |
| `--hf-duration-base` | 180 ms |
| `--hf-duration-slow` | 280 ms |
| `--hf-ease-standard` | `cubic-bezier(.2, 0, 0, 1)` |
| `--hf-ease-emphasis` | `cubic-bezier(.2, .8, .2, 1)` |

Se anima transform/opacity, no layout, salvo acordeones pequeños. El pulso de
“en vivo” es discreto y se desactiva con `prefers-reduced-motion`.

Con reducción de movimiento:

- duración efectiva ≤ 1 ms para decoraciones;
- sin smooth scroll forzado;
- sin autoplay de carruseles;
- loaders conservan un estado estático anunciable.

## 10. Contrato de estados para componentes

Toda primitiva interactiva implementa:

- normal;
- hover cuando existe puntero;
- `focus-visible` con anillo común;
- active/pressed;
- disabled con `disabled`/`aria-disabled`;
- loading con nombre accesible y ancho estable;
- error asociado por `aria-describedby` cuando corresponde;
- touch ≥ 44 px;
- modo mobile/desktop explícito;
- contraste AA;
- sin depender solo del color.

Los componentes de datos implementan:

- loading;
- success;
- empty;
- error;
- offline/timeout si dependen de red cliente;
- dato parcial;
- imagen/logo ausente;
- información no confirmada.

## 11. Primitivas

### Botón

Variantes: `primary`, `secondary`, `quiet`, `inverse`, `danger`.

- altura 44 px, compacto 36 px solo desktop;
- label estable durante loading;
- spinner + `aria-busy`;
- icono final/inicial no reemplaza label salvo botón de icono;
- primary coral; secondary borde tinta/teal; quiet sin caja permanente.

### Botón de icono

- 44 × 44;
- `aria-label` obligatorio;
- tooltip desktop;
- estado toggle usa `aria-pressed`;
- badge no tapa el foco.

### Enlace

- inline: subrayado con offset;
- navegación: peso + indicador activo;
- entidad: área completa enlazada sin anidar botones;
- externo: icono/texto accesible si abre nueva pestaña.

### Tabs

- patrón `tablist` solo si cambia contenido en la misma URL;
- enlaces con `aria-current` si navegan;
- altura 44 px;
- scroll horizontal con inicio/fin visible en mobile;
- indicador de 2 px y texto de peso 700;
- flechas de teclado en tabs reales.

### Chip y badge

- chip: filtro o toggle, mínimo 36 px;
- badge: estado no interactivo;
- siempre texto; icono complementario;
- estados deportivos usan el vocabulario definido.

### Inputs, selects y textarea

- label visible;
- altura 44–48 px;
- placeholder no reemplaza label;
- help/error reservan ritmo y usan `aria-describedby`;
- select nativo donde sea suficiente;
- autocomplete declara propósito;
- nombres largos envuelven en dropdown.

### Dropdown y tooltip

- dropdown con navegación teclado, Escape y retorno de foco;
- no contiene acciones destructivas sin confirmación;
- tooltip no contiene información indispensable;
- tooltip aparece por hover y foco, con `role="tooltip"`.

### Modal y dialog

- `role="dialog"`/elemento `dialog`, título asociado;
- focus trap y restauración;
- Escape salvo proceso crítico;
- body scroll bloqueado y restaurado;
- acciones en orden estable;
- ancho máximo 560 px.

### Drawer y bottom sheet

- drawer para navegación lateral;
- sheet para favoritos, más opciones y filtros mobile;
- handle solo decorativo; botón de cerrar accesible;
- no más alto que el viewport y contenido interno scrollable;
- respeta safe areas.

### Toast

- éxito/información `role="status"`;
- error urgente `role="alert"`;
- no es la única confirmación de una mutación;
- pausa con hover/foco;
- máximo tres visibles.

## 12. Componentes de estado

### Skeleton

- replica bloques, no texto falso;
- mantiene altura final;
- sin shimmer con reduced motion;
- `aria-hidden`; contenedor anuncia carga.

### Loader

- solo para acción o espera indeterminada pequeña;
- texto “Cargando…” contextual;
- nunca reemplaza toda una página si existe skeleton.

### Empty state

Estructura:

1. título factual;
2. explicación breve;
3. acción real si existe;
4. nunca una ilustración que ocupe más que el contenido.

Ejemplos: “No hay partidos para esta fecha”, “Todavía no agregaste equipos”,
“La formación no fue publicada”.

### Error state

- mensaje de producto, no stack o código técnico;
- diferencia error, offline, timeout y permiso;
- reintento si es seguro;
- link a una salida estable;
- detalle técnico solo en logging.

## 13. Contenedores y datos

### Card/panel

- card reservada a entidades independientes;
- panel para agrupar una sección;
- borde antes que sombra;
- encabezado opcional con acción real;
- padding mobile 16 px, desktop 20–24 px.

### Fila/lista

- toda la fila puede ser enlace si no contiene controles anidados;
- equipos alineados por logo/nombre;
- marcador en columna de ancho estable;
- separador 1 px;
- hover suave y foco interno visible;
- nombres largos: dos líneas en mobile, una con tooltip solo en tabla densa.

### Tabla

- encabezados `th` y scope;
- números alineados al final y tabulares;
- primera columna identificadora;
- sticky header solo con contexto;
- mobile: columnas esenciales + expansión o scroll anunciado;
- posición, PJ y PTS nunca se ocultan en standings;
- cero distinto de dato ausente (`—`).

### Acordeón

- botón semántico con `aria-expanded`/`aria-controls`;
- objetivo 44 px;
- contenido permanece ordenado en DOM;
- no se usa para esconder la información principal.

### Paginación

- anterior/siguiente con texto;
- página actual `aria-current`;
- mobile reduce páginas intermedias, no acciones;
- respeta URL.

### Selector de fecha

- anterior, fecha central y siguiente;
- acción “Hoy” cuando aplica;
- calendario accesible si se incorpora;
- la fecha central usa texto humano y valor completo accesible;
- estado seleccionado persiste en URL.

### Breadcrumb

- `nav` con label;
- lista ordenada;
- último elemento no enlazado y `aria-current`;
- mobile muestra back + contexto si la ruta completa no entra.

## 14. Componentes deportivos

### Escudo/avatar

- contenedor de tamaño estable;
- `object-fit: contain` para escudos;
- foto usa cover solo si corresponde;
- fallback con inicial/forma y nombre accesible;
- no se muestra icono de imagen rota;
- tamaños: 24, 32, 48, 72 y 104 px.

### Indicador de partido

Compuesto por icono/forma, label y valor temporal. Ejemplos:

- punto + EN VIVO + `67'`;
- check + FINAL;
- reloj + `21:30`;
- pausa + SUSPENDIDO.

### Marcador

- números tabulares;
- separador no leído como signo negativo;
- penales y global con label explícito;
- `aria-label` describe resultado completo;
- no cambia el orden local/visitante;
- soporta valores de dos dígitos y nombres largos.

### Fila de partido

Grid base:

```text
estado | local       | marcador/hora | visitante   | acciones
```

Mobile apila equipo/marcador sin reducir nombres. TV/incidencias pasan a una
segunda línea dentro de la misma fila. Favorito/recordatorio no bloquea el
enlace al partido.

### Estadística comparada

- valor local, label, valor visitante;
- barra con escala calculada sobre valores válidos;
- iguales ocupan proporciones iguales;
- porcentajes se limitan 0–100;
- absolutos se normalizan por suma/máximo según métrica;
- nulo muestra `—` y no genera una barra engañosa.

### Formación

- cancha adaptable, sin texto superpuesto;
- posición con punto/dorsal y nombre fuera del punto si es necesario;
- lista accesible equivalente en DOM;
- jugador enlazado solo si hay ID;
- suplentes y técnico en panel separado;
- ausencia con empty state.

### Standings

- posición, equipo, PJ, diferencia y puntos como mínimo;
- forma V/E/D con letra;
- zonas clasificatorias explicadas en leyenda;
- grupos conservan encabezado;
- columnas secundarias expandibles mobile.

### Llave

- desktop horizontal por fases;
- mobile vertical por fase;
- serie enlaza sus partidos;
- ida/vuelta, global y penales etiquetados;
- “A confirmar” usa placeholder neutro sin warnings de consola.

## 15. Navegación y búsqueda

### Header

- mobile 56 px; desktop dos franjas 64 + 44;
- marca con dimensiones reservadas y prioridad cuando es LCP;
- active visible;
- no desaparece en Prode;
- Mundial usa un acento, no otra cabecera.

### Bottom nav

- cinco acciones;
- safe area;
- label siempre visible;
- estado activo por forma, peso y color;
- no cubre el final del contenido.

### Búsqueda global

- pantalla completa mobile, dialog desktop;
- encabezado/input sticky;
- grupos con heading y cantidad;
- item muestra tipo, identidad y contexto;
- active descendant para flechas;
- footer con atajos solo desktop;
- carga y cero resultados con altura estable.

## 16. Editorial, formularios y admin

### Editorial

- titular serif; metadata/body sans;
- imagen 16:9 o proporción declarada;
- caption y alt diferenciados;
- cuerpo 72ch;
- relacionados usan el mismo componente de entidad, no un blog genérico.

### Formularios

- agrupación con `fieldset`/`legend`;
- acción primaria al final;
- validación inline y resumen si hay múltiples errores;
- disabled durante mutación;
- confirmación persistente;
- no se pierde contenido ante un error recuperable.

### Admin

- usa densidad compacta;
- fondo/superficie/tipos comunes;
- color de contexto administrativo sin parecer producción pública;
- acciones mutantes explicitan verbo y alcance;
- no prefetch de endpoint mutante;
- permisos y errores se muestran antes del formulario.

## 17. Accesibilidad

Objetivo: buenas prácticas equivalentes a WCAG 2.2 AA.

- contraste mínimo 4.5:1 para texto normal, 3:1 para grande/controles;
- landmarks `header`, `nav`, `main`, `aside`, `footer`;
- un `h1` descriptivo por pantalla;
- orden de headings sin saltos arbitrarios;
- skip link al contenido;
- foco visible uniforme;
- orden DOM coincide con lectura visual;
- actualización en vivo usa anuncios moderados, no repite cada refresh;
- marcador, estado y barras tienen alternativa textual;
- iconos decorativos `aria-hidden`;
- alt describe propósito, no repite el texto vecino;
- targets 44 px;
- focus trap/restauración en overlays;
- reduced motion;
- zoom 200% y reflow 320 CSS px sin pérdida.

## 18. Performance y RSC

- shell y datos base siguen en Server Components cuando sea posible;
- Client Components se limitan a overlays, persistencia y controles;
- no se crea un provider global para estado que puede ser local;
- imágenes con tamaños/`sizes` reales y espacio reservado;
- logo global con carga prioritaria adecuada;
- assets inexistentes no se solicitan;
- componentes complejos (llaves, simulador, video) se difieren si quedan fuera
  de la prioridad inicial;
- slots de anuncios reservan tamaño;
- no se añade dependencia UI;
- fetch compartido/caché evita repetir proveedor;
- skeleton mantiene CLS bajo.

## 19. Organización en código

Implementación prevista:

```text
src/frontend/components/ui/
├── Button.tsx
├── IconButton.tsx
├── Badge.tsx
├── Surface.tsx
├── EmptyState.tsx
├── ErrorState.tsx
├── Skeleton.tsx
└── ...

src/frontend/components/sports/
├── MatchStatus.tsx
├── Score.tsx
├── TeamIdentity.tsx
├── MatchListItem.tsx
├── ComparisonStat.tsx
└── ...

src/app/
├── globals.css        # tokens, reset y utilidades globales
└── ...
```

Las primitivas no conocen Supabase ni API-Football. Los adaptadores de módulo
transforman los modelos existentes a props presentacionales. No se reemplazan
los normalizadores de negocio.

## 20. Definición de terminado del sistema

El sistema se considera implementado, no solo documentado, cuando:

1. tokens existen en CSS y no hay un segundo set activo;
2. layout, header, bottom nav, estados y foco usan esos tokens;
3. los componentes base cubren estados y accesibilidad;
4. no aparecen hex/radios/sombras nuevos sin token;
5. Mundial, Prode, Mi Torneito, Auth y admin se ven parte del mismo producto;
6. la matriz de viewports no presenta overflow;
7. contraste y teclado fueron verificados;
8. no se añadió una dependencia de UI o fuente;
9. la guía coincide con el código entregado.

Este documento es el contrato visual. Cualquier excepción debe quedar
registrada con motivo, alcance y alternativa.
