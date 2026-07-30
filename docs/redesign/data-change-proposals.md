# Hay Fulbo: propuestas de datos no ejecutadas

Fecha: 2026-07-30  
Estado: documentación solamente  
Alcance ejecutado sobre Supabase: ninguno

Este documento registra capacidades que no pueden completarse con el contrato
actual. No se crearon migraciones, no se modificó el esquema, no se tocaron
políticas RLS, grants, funciones, triggers ni registros.

## 1. Goleadores de Mi Torneito

### Motivo

El repositorio público de Mi Torneito expone torneos, fechas, partidos,
equipos y resultados, pero no ofrece eventos de partido ni autores de gol.
Por ese motivo se puede calcular la tabla de posiciones, pero no una tabla de
goleadores real.

### Propuesta separada

- incorporar una entidad de eventos de partido vinculada al partido y al
  equipo;
- registrar como mínimo minuto, tipo de evento, jugador, equipo y condición
  de gol válido;
- definir identidad de jugadores/planteles antes de aceptar eventos;
- agregar índices por torneo, partido, equipo y jugador;
- diseñar RLS para que solo organizadores asignados puedan escribir y el
  público lea únicamente torneos publicados;
- derivar goleadores desde eventos válidos, sin almacenar un ranking
  duplicado.

### Impacto

Requiere diseño de esquema, políticas, formularios del organizador, auditoría
de permisos y pruebas de consistencia al editar o anular un gol. No debe
implementarse como una columna o contador aislado.

## 2. Trayectoria histórica de jugadores

### Motivo

La fuente deportiva disponible entrega identidad, club/selección actual y
estadísticas por competencia, pero no una cronología contractual completa y
confiable para todos los jugadores.

### Propuesta separada

- evaluar una fuente autorizada de transferencias o historial de planteles;
- definir procedencia, fecha de actualización y nivel de certeza;
- conservar temporadas y préstamos sin inferirlos desde apariciones
  aisladas;
- cachear el resultado en servidor y mantener las claves del proveedor fuera
  del cliente.

### Impacto

Puede aumentar consumo de proveedor y exige reglas editoriales para datos
parciales o contradictorios. Hasta contar con esa fuente, la ficha muestra
solo relaciones y estadísticas verificables.

## Criterio de aprobación futura

Cada propuesta necesita autorización explícita, migración revisable en una
rama separada, entorno de prueba aislado, revisión de RLS, plan de rollback y
QA con datos no productivos. Este rediseño no ejecuta ninguna de esas acciones.
