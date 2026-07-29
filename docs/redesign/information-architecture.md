# Hay Fulbo: nueva arquitectura de información

Estado: Etapa 2 definida  
Fecha: 2026-07-29  
Principio rector: encontrar el partido primero; entender el contexto después.

## 1. Objetivos medibles

La arquitectura nueva debe permitir:

- llegar al partido de hoy desde cualquier pantalla en un toque/clic;
- distinguir vivo, próximo, finalizado y excepcional sin abrir el detalle;
- llegar de partido a competencia o equipo con un solo paso;
- llegar de equipo a competencia con un solo paso;
- acceder a búsqueda, favoritos, notificaciones y cuenta desde todo el sitio;
- mantener en dos niveles visibles la navegación de una competencia;
- no superar tres transiciones para ninguna sección pública principal;
- conservar la fecha seleccionada al volver desde un partido cuando la URL la
  representa;
- integrar Mundial, Prode y Mi Torneito sin cabeceras o marcas paralelas.

## 2. Modelo mental

Hay Fulbo se organiza en cuatro entidades centrales:

1. **Partidos**: la entrada urgente y temporal.
2. **Competiciones**: el contexto, formato, tabla y llave.
3. **Protagonistas**: equipos, selecciones y jugadores.
4. **Historias**: noticias, análisis y mercado.

Prode y Mi Torneito son herramientas participativas dentro del mismo producto:

- Prode se relaciona con partidos oficiales y cuenta.
- Mi Torneito se relaciona con torneos, equipos y partidos amateur.
- Mundial 2026 es una competencia destacada, no una aplicación separada.

## 3. Navegación global mobile

### Barra superior

Altura objetivo: 56 px más safe area.

- marca compacta, enlazada a inicio;
- indicador “En vivo” solo cuando hay partidos reales en vivo;
- campana;
- acceso a cuenta/avatar.

No aloja enlaces textuales largos ni una segunda fila permanente.

### Barra inferior

Altura táctil objetivo: 64 px más safe area.

1. **Inicio** → `/`
2. **Partidos** → `/?fecha=<hoy>#partidos`
3. **Buscar** → diálogo global
4. **Favoritos** → bottom sheet global
5. **Más** → bottom sheet de secciones

“Buscar” ocupa el centro porque atraviesa todas las entidades. Prode deja de
ocupar una posición fija que excluía otras tareas más frecuentes.

### Hoja “Más”

Orden:

1. Competiciones
2. Mundial 2026
3. Equipos
4. Estadísticas
5. Noticias
6. Mercado de pases
7. Prode
8. Mi Torneito
9. Perfil o Iniciar sesión
10. idioma, ayuda y enlaces institucionales

La hoja usa grupos y encabezados, no una lista profunda de todas las ligas.
“Competiciones” abre el índice navegable con búsqueda/filtros.

### Navegación contextual mobile

- breadcrumb compacto o back con destino identificable;
- título/identidad de la entidad;
- tabs horizontales con scroll controlado, `aria-current` y un indicador
  textual;
- las tabs importantes no se esconden en un dropdown;
- en equipo/selección, “Competiciones” aparece inmediatamente después de la
  identidad;
- en partido, el resumen esencial precede a las tabs;
- en competencia, “Partidos”, “Tabla/Grupos”, “Llave”, “Líderes” y “Más” se
  adaptan a las capacidades reales.

## 4. Navegación global desktop

### Header

Se abandona la sidebar permanente. Un header horizontal de dos franjas
conserva ancho para datos deportivos y devuelve una estructura más editorial:

**Franja 1 (64 px):**

- marca;
- búsqueda expandible;
- favoritos;
- notificaciones;
- cuenta.

**Franja 2 (44 px):**

- Partidos
- Competiciones
- Mundial 2026
- Noticias
- Prode
- Mi Torneito

El estado activo usa subrayado, peso y `aria-current`, no un bloque verde.

### Contenido

- ancho máximo global: 1280 px;
- home: columna principal de partidos y rail editorial/contextual;
- páginas de datos: columna principal, con rail solo si aporta información;
- artículos: medida de lectura entre 68 y 76 caracteres;
- admin: shell operativo propio pero con los mismos tokens y componentes.

### Navegación contextual desktop

Una barra debajo del encabezado de la entidad contiene tabs adaptadas. Puede
volverse sticky debajo del header, sin duplicar marca ni navegación global.

## 5. Jerarquía por tipo de pantalla

### Home

1. fecha y control de día;
2. resumen del día: vivos, próximos y terminados;
3. partidos, agrupados por competencia;
4. favoritos relevantes;
5. noticias principales;
6. accesos a competiciones y herramientas.

En mobile el flujo es lineal. En desktop, favoritos/noticias pueden ocupar un
rail, pero nunca interrumpen una lista de partidos.

### Partido

1. breadcrumb competencia → etapa/jornada;
2. cabecera con estado, equipos y marcador;
3. estadio, árbitro, TV y acciones;
4. navegación contextual;
5. resumen;
6. cronología;
7. estadísticas;
8. formaciones/suplentes/técnicos;
9. videos e información adicional;
10. historial relacionado.

La cabecera cambia su densidad según el estado; no cambia el orden de equipos
ni oculta el marcador.

### Competencia

1. identidad, país, temporada y estado de la fase;
2. navegación contextual generada por capacidades;
3. módulo prioritario real de la competencia;
4. módulos secundarios.

No se fuerza una tabla a una copa sin tabla, ni una llave a una liga. El
selector de fase aparece solamente si hay más de una fase.

### Equipo o selección

1. identidad, país, favorito y metadata;
2. competiciones (primero también en mobile);
3. próximos partidos;
4. forma y últimos resultados;
5. plantel;
6. estadísticas e historia disponibles;
7. noticias.

### Jugador

1. identidad y equipo/selección;
2. resumen de temporada;
3. estadísticas;
4. partidos/competiciones;
5. trayectoria e historias disponibles.

### Noticias

1. portada con una historia principal real;
2. categorías;
3. últimas historias;
4. mercado/análisis relacionados.

El artículo reutiliza header, navegación, superficies y estados del producto,
pero usa una medida de lectura editorial.

### Prode

1. estado de sesión y fecha/reglas;
2. partidos pronosticables;
3. mis resultados/puntos;
4. ranking;
5. torneos privados.

No tiene header global duplicado. Torneos privados agregan navegación
contextual dentro del mismo shell.

### Mi Torneito

1. propuesta y torneos reales;
2. listado/descubrimiento;
3. solicitud;
4. acceso organizador si corresponde.

En un torneo:

1. identidad;
2. fecha actual;
3. fixture/resultados;
4. tabla;
5. equipos;
6. goleadores;
7. información.

El panel organizador usa la misma identidad visual y una densidad operativa
mayor. Nunca usa resultados de demostración.

### Administración

1. contexto administrativo inequívoco;
2. navegación lateral/compacta por tarea;
3. estado del sistema;
4. tabla/formulario;
5. confirmación explícita para acciones mutantes.

El rediseño no cambia permisos ni convierte endpoints GET mutantes en enlaces
prefetcheables.

## 6. Relación entre entidades

```text
Fecha
└── Competencia
    └── Partido
        ├── Equipo local ── Jugadores
        ├── Equipo visitante ── Jugadores
        ├── Estadio / TV / árbitro
        └── Eventos / estadísticas / formaciones

Competencia
├── Fixture ── Partido
├── Tabla o grupos ── Equipo
├── Llave ── Partido
├── Líderes ── Jugador
└── Noticias / historia

Cuenta
├── Perfil
├── Prode ── Torneo privado
└── Permisos de Mi Torneito

Preferencias locales
├── Favoritos ── Equipo / selección
├── Recordatorios ── Partido
└── Notificaciones derivadas
```

Todos los nombres de entidad con ID conocido deben ser enlaces. Si el ID no
está disponible, el texto no aparentará interactividad.

## 7. Búsqueda

El diálogo global unifica:

- equipos y selecciones;
- jugadores;
- competiciones;
- partidos próximos/recientes;
- noticias, análisis y mercado;
- torneos públicos de Mi Torneito;
- accesos del producto.

Comportamiento:

- abre con foco en input y conserva el invocador;
- `Escape` cierra;
- flechas recorren resultados; Enter navega;
- Tab permanece dentro del diálogo;
- resultados agrupados con cantidad y tipo;
- búsqueda normalizada sin acentos;
- carga diferida, error recuperable y cero resultados;
- limpiar query sin cerrar;
- en mobile usa pantalla completa; en desktop, panel de ancho controlado.

La fuente global puede ampliarse sin llamar API-Football desde el cliente. Los
jugadores y torneos deben consultarse mediante lectura server-side limitada y
cacheada.

## 8. Favoritos y notificaciones

### Favoritos

- accesibles desde header/barra inferior;
- sheet mobile y popover/rail desktop;
- estado vacío con acción de búsqueda;
- quitar requiere un control claro, no confirmación destructiva;
- se conserva el mecanismo actual de localStorage;
- no se simula sincronización con cuenta;
- la lectura inicial debe ser hidratación-segura.

### Notificaciones

- campana siempre visible;
- etiqueta explica que reúne partidos en vivo, favoritos y recordatorios;
- push solo se ofrece si el navegador y la configuración lo permiten;
- sin notificaciones usa estado honesto;
- “marcar leídas” y “limpiar” conservan persistencia local;
- cada notificación navega a su entidad.

## 9. Mundial 2026

Mundial se destaca mediante:

- acceso principal;
- acento visual secundario propio;
- portada y navegación contextual;
- cobertura editorial.

Sigue siendo `/liga/selecciones-mundial`, usa el shell global y comparte
componentes de partido, selección, jugador, tabla, grupo, llave, estados y
favoritos. No crea rutas, contratos ni una navegación global paralela.

## 10. Profundidad y recuperación

| Destino | Camino máximo desde cualquier pantalla |
| --- | ---: |
| Home/partidos de hoy | 1 |
| Búsqueda/favoritos/notificaciones | 1 |
| Competencia principal | 2 |
| Partido | 2 |
| Equipo/selección | 2 |
| Jugador | 3 |
| Noticia | 2 |
| Prode/Mi Torneito | 2 |
| Perfil | 2 |

Cada detalle muestra un back útil y breadcrumbs donde el espacio lo permite.
La ruta inexistente ofrece volver a inicio, partidos y búsqueda.

## 11. URLs y estado navegable

- no se renombran rutas públicas;
- fecha, tab o fase se llevan a URL cuando compartir/volver lo requiere;
- filtros puramente visuales pueden permanecer locales;
- los anchors existentes relevantes (`#partidos`, `#favoritos`,
  `#simulador-mundial`) se preservan o redirigen al destino equivalente;
- no se pierde scroll/fecha al volver si el navegador puede restaurarlos;
- la navegación no depende de JavaScript para enlaces fundamentales.

## 12. Criterios responsive de arquitectura

- 320–430: una columna; sheets de ancho completo; barra inferior;
- 768–1024: una o dos columnas según contenido, navegación global mobile
  hasta que la franja desktop tenga ancho real;
- 1280–1920: máximo 1280, rail opcional, header desktop;
- tablas anchas se transforman en vista de columnas prioritarias más detalle,
  o scroll con primer columna fijada y señal visible;
- llaves usan fases apiladas en mobile, no una miniatura ilegible;
- formaciones usan cancha adaptable y lista alternativa accesible;
- no se ocultan marcador, posición, puntos ni acción primaria.

Esta arquitectura es el contrato de composición para el concepto visual y el
sistema de diseño.
