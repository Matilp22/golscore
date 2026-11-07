# Hay Fulbo Fantasy — núcleo aislado de reglas (7 noviembre 2026)

Este cambio agrega utilidades puras y pruebas **sin rutas públicas, tablas, datos reales ni cambios en producción**.

## Reglas implementadas
- Plantel de 26 a 32, con 11 titulares, exactamente 5 suplentes ordenados y 10–16 reservas. Sin jugadores repetidos.
- Cada jugador se bloquea individualmente al comenzar su partido real, incluso al instante exacto. Si el horario es desconocido, se bloquea por precaución. El servidor debe ser autoridad horaria.
- Reemplazo automático solo cuando un titular registra **exactamente cero minutos confirmados** en un partido finalizado. Nunca por bajo rendimiento. El suplente elegible debe haber jugado minutos positivos confirmados en partido finalizado, no estar ya usado y conservar una formación válida.
- Recompra del sistema al 75% del valor oficial congelado (unidades enteras) cuando el jugador deja la liga cubierta.

## Arquitectura y pendientes
- Núcleo en `src/server/fantasy/rules.mjs`; pruebas: `node --test src/server/fantasy/rules.test.mjs`.
- El chequeo de posiciones es un callback requerido; **todavía no existe el validador de formaciones**. No integrar estos helpers en endpoints antes de diseñarlo.
- El algoritmo resuelve titulares ausentes en el orden del once recibido; **orden provisional**, requiere definición funcional si hay competencia por un mismo suplente.
- Persistir posteriormente con transacciones, RLS, snapshots de kickoff, auditoría/versionado, idempotencia, valor congelado y protección contra doble gasto.
- API-Football: comprobar disponibilidad/cobertura de minutos por liga, partidos reprogramados, suspendidos y correcciones tardías. Minutos no informados no equivalen a cero.
- Gran DT 2026 utiliza notas Clarín y reglas de bloqueo diferentes: estudiar el referente, no copiar reglas; ver https://www.grandt.clarin.com/pdf/Reglamento_Gran_DT.pdf
- API-Sports exige evaluar licencias sobre escudos, fotos y marcas: https://api-sports.io/documentation/football/v3

## Verificaciones antes de integrar
- Ejecutar pruebas unitarias de este PR; luego `npm run lint`, `npm run typecheck`, `npm run build` sobre el repo completo.
- Pruebas adicionales: cambios simultáneos, carreras de kickoff, fixture reprogramado, datos ausentes, suplentes sin minutos, posiciones legales, recompras, valor congelado.
- No desplegar ni migrar bases con este PR. Prode, resultados, favoritos y autenticación permanecen intactos.
