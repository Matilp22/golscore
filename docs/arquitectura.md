# Arquitectura

FulboApp queda organizado como una app Next.js App Router lista para Vercel, con separacion interna por responsabilidad.

## Capas

- `src/app`: rutas publicas, layouts y route handlers de Next.js.
- `src/frontend`: componentes visuales, formularios, navegacion y UI cliente.
- `src/server`: integraciones server-side, cache, reglas de negocio y servicios seguros.
- `src/lib`: compatibilidad de imports y clientes compartidos, como Supabase.
- `src/shared`: configuraciones y tipos que pueden ser usados por UI y servidor.
- `frontend`: documentacion/env example de variables publicas; no es un paquete separado.
- `supabase`: migraciones, seed, config y Edge Functions.
- `docs`: documentacion tecnica minima.

## Decision principal

No se movio el proyecto completo a `frontend/` porque Next.js ya esta configurado en raiz y usa `src/app`. Moverlo fisicamente obligaria a reconfigurar Vercel, TypeScript, lockfile y scripts. La separacion se hizo dentro de `src/`, que es la opcion mas segura y mantenible para App Router.

## Lógica sensible

La API externa, cache persistente, bloqueo del prode, guardado definitivo y calculo de puntos viven en servidor o Supabase. La UI solo debe mostrar estados y llamar endpoints.
