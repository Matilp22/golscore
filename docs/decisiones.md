# Decisiones de producto y frontend

Este documento resume las decisiones importantes que se fueron tomando durante la evolucion de `FulboApp`, con foco en estructura, UI, comportamiento del detalle de partido, integracion con la API y criterios de diseno.

## 1. Base del proyecto

- Se corrigieron errores de tipado, warnings de lint y problemas de build.
- Se reforzo la integracion con API-Football con tipos mas claros para fixtures, eventos, alineaciones, estadisticas y equipos.
- Se limpiaron problemas de codificacion de texto y archivos conflictivos.
- El proyecto se valida regularmente con `npm run lint` y `npm run build`.

## 2. Estructura de la home

- La home se reorganizo con una logica inspirada en Promiedos, pero con una lectura mas limpia y minimalista.
- Se corrigio el agrupado de partidos para evitar ligas duplicadas y partidos mal ubicados.
- Se definieron secciones fijas por pais o bloque competitivo.
- La navegacion lateral de secciones queda siempre visible.
- El contenido central muestra solo las secciones que realmente tienen partidos para la fecha elegida.
- `Ayer / Hoy / Manana` quedo centrado por debajo del encabezado.

## 3. Criterio visual general

- Se mantuvo una estetica sobria, oscura y compacta.
- Se evito una copia literal de Promiedos; la idea fue conservar la logica futbolera pero con una presentacion mas prolija.
- Se probaron escalas globales de interfaz para ajustar densidad visual.
- La tipografia general volvio a su estado original luego de una prueba mas editorial.
- La mejora tipografica quedo solo en estadisticas, donde los valores principales necesitan mas presencia.

## 4. Detalle del partido

- El encabezado del detalle se rediseno para integrarse mejor con el resto del sitio.
- Cada equipo tiene su panel propio, con acceso a la ficha del club.
- Se mejoro la presentacion del estadio, ubicacion y arbitro.
- La ubicacion ahora intenta mostrarse como `Ciudad (Provincia/Region)` cuando el campo de la API viene compuesto.
- El arbitro se formatea como `Nombre (Nacionalidad)` cuando la API lo devuelve como `Nombre, Pais`.

## 5. Colores reales del partido

- Se intento usar siempre los colores reales que devuelve la API en las alineaciones.
- Cuando la API no trae bien esos datos o vienen inconsistentes, se aplican presets por equipo.
- Se corrigio un problema donde el color de la camiseta y el del numero estaban invertidos.
- Si la camiseta es muy clara o blanca, el numero se fuerza a un color mas contrastante.
- Los colores del equipo tambien impactan en paneles y encabezados del detalle.

## 6. Formacion en cancha

- La cancha se dibuja con los jugadores ubicados segun la grilla de la formacion.
- Se ajusto varias veces el tamano del bloque de jugador para evitar superposicion.
- Se hicieron mas chicas las camisetas y se compacto el ancho del bloque visual.
- Se aumento el aire entre camiseta y nombre del jugador.
- Los indicadores de gol, amarilla y roja quedaron ubicados en el margen inferior derecho de la camiseta.
- El capitan muestra una marca `C` del lado izquierdo.
- Si la API no informa bien quien es el capitan, se usa un fallback dentro del once inicial para garantizar que siempre haya uno visible.

## 7. Diferencia entre cancha y listas

Esta es una decision importante del producto.

### En la cancha

- Si un jugador es reemplazado, la posicion pasa a mostrar al jugador que entra.
- El jugador que sale queda como referencia secundaria, mas chico, a la derecha.
- Esa referencia secundaria incluye camiseta y nombre reducido para no competir con los demas indicadores.

### En las listas

- Los titulares no se reemplazan.
- Los suplentes tampoco se reemplazan.
- En `Titulares`, el jugador titular se conserva y abajo se muestra por quien salio.
- En `Suplentes`, el jugador suplente se conserva y abajo se muestra por quien ingreso.

## 8. Paneles de titulares y suplentes

- Debajo de la cancha, cada equipo tiene un panel propio.
- Cada panel tiene dos solapas:
  - `Titulares`
  - `Suplentes`
- El nombre del equipo va arriba.
- Las tabs van entre el nombre del equipo y el bloque del DT.
- El DT se muestra siempre, sin importar la solapa activa.
- En esas listas tambien se conservan capitan, goles, tarjetas y contexto de sustitucion.

## 9. Minuto a minuto

- El minuto a minuto se enriquecio para que cada evento tenga una identidad visual clara.
- Cada tipo de evento se clasifica y traduce.

### Iconografia adoptada

- Amarilla: tarjeta amarilla visual.
- Roja: tarjeta roja visual.
- Gol: pelota.
- Penal convertido: arco blanco con pelota al centro.
- Penal errado: mismo arco, tachado con una cruz roja.
- VAR: pantallita y texto `VAR`.
- Cambio: flecha verde y flecha roja.

### Informacion secundaria

- En goles se muestra la asistencia si la API la trae.
- En tarjetas se muestra el detalle traducido en espanol.
- En cambios se muestra quien sale.
- En VAR se usa el texto del propio evento o del comentario si existe.

## 10. Estadisticas

- Se reemplazo el listado simple de valores por tarjetas comparativas.
- Cada estadistica muestra valor local, etiqueta y valor visitante.
- Se implemento una barra horizontal unica que ocupa todo el ancho.
- El punto donde cambia el color depende exactamente de la proporcion entre ambos valores.
- La barra mantiene el estilo general del sitio, sin convertirse en un widget visual ajeno.

## 11. Equipos

- Se agrego una vista propia por equipo.
- Desde el detalle del partido se puede navegar a la ficha del club.
- La ficha usa datos del equipo y del plantel desde la API.

## 12. Refresco y consumo de API

Se tomaron varias decisiones para mejorar performance y cuidar requests.

- La API externa se consume solo del lado del servidor.
- La key nunca se expone al cliente.
- Se agrego cache server-side con TTL.
- Se implemento deduplicacion de requests iguales en vuelo.
- Los fixtures y el detalle del partido usan TTL corto.
- Los datos de equipo usan TTL mas largo.
- Hay un boton manual `Actualizar` en la esquina superior derecha.
- Tambien existe autorefresco.

### Estado actual del refresco

- El usuario puede refrescar manualmente desde el boton.
- La vista tambien se refresca automaticamente en intervalos controlados.
- El sistema fue ajustado varias veces para equilibrar frescura de datos y consumo de API.

## 13. Manejo de errores

- Se mejoro la deteccion de errores de API aunque el HTTP status sea correcto.
- Si la API devuelve limites de request o respuestas vacias, el usuario ve un mensaje claro.
- Esto evita estados enganiosos donde parecia que "no habia partidos" cuando en realidad habia un problema de proveedor.

## 14. Validacion tecnica

- Los cambios se fueron validando de manera incremental.
- `npm run lint` se usa como validacion rapida constante.
- `npm run build` se usa como validacion final cuando el cambio lo requiere.
- En el entorno local, algunos builds necesitaron ejecutarse fuera del sandbox por un `EPERM` del entorno, no por error real del proyecto.

## 15. Reglas de diseno que quedaron fijas

- La barra lateral de secciones queda fija.
- El contenido central de la home muestra solo secciones activas para la fecha.
- La tipografia general del sitio se mantiene simple y legible.
- El refuerzo tipografico queda acotado a estadisticas.
- En la cancha, los cambios reemplazan visualmente al jugador.
- En listas, los jugadores no se reemplazan.
- Si la API no define capitan, se usa fallback.
- Si la API no define bien colores, se usan presets conocidos.
- Si la camiseta es muy clara, el numero se corrige por contraste.
- Las estadisticas usan una barra completa con punto de corte proporcional.

## 16. Proximos pasos posibles

- Mejorar todavia mas la lectura visual de goles, tarjetas y cambios dentro de la cancha.
- Afinar espaciados finos de la formacion para evitar superposicion en casos extremos.
- Llevar la misma logica de color de equipos a mas modulos de la UI.
- Evaluar una capa interna de endpoints propios del proyecto para encapsular todavia mas la API externa.
- Investigar WebSockets si el proveedor lo permite y si aporta valor real frente al polling optimizado.
