# AGENTS.md

## Objetivo

Este repositorio contiene una app web de resultados de futbol + prode.

El agente debe:
- trabajar sobre el codigo existente
- ejecutar cambios reales, no solo sugerencias
- validar que el proyecto funcione
- dejar el sistema listo para despliegue

## Reglas de trabajo

1. No pedir confirmacion paso a paso.
2. Priorizar codigo funcional sobre explicaciones.
3. No romper funcionalidad existente.
4. No sobreingenierizar.
5. Si algo falta, crear una implementacion minima funcional.
6. Si algo no puede completarse por credenciales o servicios externos, dejar placeholders y documentacion clara.
7. Nunca exponer secretos en frontend.
8. Toda logica sensible debe estar en servidor, route handlers o Supabase Functions.

## Estructura real del proyecto

- `src/app`: rutas Next.js App Router y route handlers.
- `src/frontend`: interfaz, componentes y UI cliente.
- `src/server`: integraciones privadas, cache, servicios y reglas de negocio.
- `src/shared`: configuracion reutilizable.
- `supabase`: migraciones y Edge Functions.
- `docs`: documentacion tecnica.

## Comandos obligatorios

```bash
npm install
npm run lint
npm run typecheck
npm run build
```
