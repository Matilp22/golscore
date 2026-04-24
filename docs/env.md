# Environment variables

La app Next.js real se ejecuta desde la raiz del repo:

```text
C:\Users\Pili y Mati\golscore
```

Por eso Next.js debe leer un unico archivo activo:

```text
C:\Users\Pili y Mati\golscore\.env.local
```

## Variables publicas de Supabase

Pegar las claves publicas en `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

No agregar `SUPABASE_SERVICE_ROLE_KEY` en frontend ni usar claves `service_role` con prefijo `NEXT_PUBLIC_`.

## Duplicados

No debe haber `.env.local` activos dentro de `frontend/`, `src/` ni subcarpetas. Si aparecen, renombrarlos a `.env.local.backup` para preservar el contenido sin que confundan el runtime.

## Reinicio

Despues de cambiar variables:

```bash
npm run dev
```

Si el servidor ya estaba corriendo, detenerlo y volver a levantarlo. Next.js no siempre recarga variables de entorno ya inyectadas en el cliente.
