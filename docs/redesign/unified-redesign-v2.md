# Hay Fulbo: rediseño integral V2

Estado: implementado y validado en entorno local aislado
Fecha: 2026-08-02
Alcance: todas las familias de rutas públicas, privadas y administrativas

## Concepto

La nueva identidad se llama **Cancha editorial**. Combina la velocidad de una
agenda deportiva con una lectura editorial clara. La interfaz evita tanto el
dashboard corporativo como las tarjetas grandes de las propuestas anteriores:
usa filas compactas, índices, reglas, superficies planas y jerarquía tipográfica.

La home ordena todos los partidos cronológicamente, incluso cuando ya
finalizaron. El estado vive dentro de cada fila y nunca altera el orden horario.
En mobile aparecen primero hora, equipos, marcador y estado; televisión,
incidencias y acciones ocupan el segundo nivel.

## Sistema visual

- Canvas verde grisáceo: `#e5eee7`.
- Superficie principal marfil frío: `#f8faf7`.
- Tinta verde profunda: `#0d2928`.
- Marca verde: `#153e3b`.
- Acción cobalto: `#315fdc`.
- Acento cálido amarillo: `#ffd364`.
- Estados deportivos: coral para vivo/alerta, verde para éxito, azul para
  información; cada estado incluye texto o iconografía además de color.
- Tipografía: familia sans condensada para títulos, marcadores e índices;
  sans de sistema para lectura, formularios y metadatos.
- Radio y sombra reducidos: la separación se construye principalmente con
  contraste de superficie, reglas y espacio.

Los tokens y las reglas compartidas se centralizan en
`src/app/redesign-v2.css`. La capa también traduce las variables semánticas
anteriores para que la lógica reutilizada no cree islas visuales.

## Familias reconstruidas

- shell, header, navegación desktop/mobile, buscador, favoritos,
  notificaciones, footer y publicidad;
- home cronológica, fecha, filtros, partidos, noticias y accesos;
- detalle e historial de partido, cronología, estadísticas, formaciones,
  planteles, videos e información contextual;
- competencias, tablas, grupos, llaves, estadísticas, campeones y directorios;
- equipos, selecciones y jugadores;
- Mundial 2026, sedes, historia, selecciones, noticias y simulador de llaves;
- noticias, análisis y mercado de pases;
- Prode, torneos privados y Mi Torneito;
- login, registro, recuperación, perfil y estados sin sesión;
- administración, páginas de confianza, 404, loading, error y estados vacíos;
- juego Adiviná el futbolista.

## Datos y arquitectura preservados

No se reemplazaron fuentes reales por mocks. Se conservaron contratos,
cachés, route handlers, API-Football, Supabase Auth, favoritos locales,
notificaciones, SEO, AdSense y analíticas. No se modificaron esquema,
migraciones, RLS, triggers, grants ni variables remotas de Supabase.

Se corrigió una fuga funcional en la ficha de equipos: los clubes sin datos
especiales ya no reciben por defecto datos propios de una selección.

## Responsive y accesibilidad

La composición se validó en 320, 360, 390, 412, 430, 768, 820, 1024, 1280,
1366, 1440 y 1920 px. Tablas y llaves adoptan presentaciones específicas en
pantallas estrechas; la información esencial no se oculta.

Controles, modales, sheets y enlaces tienen nombre accesible, foco visible y
objetivos táctiles. Se respeta `prefers-reduced-motion`, se evitan IDs
duplicados y ninguna imagen queda sin `alt`.

## Verificación local

- `npm install`: correcto; 493 paquetes, 3 vulnerabilidades altas informadas
  por npm y no corregidas automáticamente para evitar cambios incompatibles.
- `npm run lint`: correcto.
- `npm run typecheck`: correcto.
- `npm run build`: correcto; 83 páginas generadas.
- verificadores de contenido, llaves y lecturas públicas: correctos.
- suite E2E: los 47 escenarios quedaron validados por bloques contra el build
  local, evitando la caída por memoria que producía una única pasada extensa.
- smoke HTTP final: home, fecha, partido, historial, equipo, jugador, Mundial,
  competiciones, noticias, mercado, Prode, Mi Torneito, Auth y admin devuelven
  `200`; la ruta inexistente devuelve `404`.

El servidor de revisión es local y no constituye un Preview Deployment. No se
realizó push, merge, promoción ni despliegue de producción.
