# Assets manuales Hay Fulbo

Estos assets se consumen desde `public/` y no dependen de Vercel Blob, Supabase Storage ni dominios remotos.

## Logo

- `public/brand/logo/hay-fulbo-logo.png`

El repo deja un PNG existente copiado en esa ruta para evitar imagen rota. Se puede reemplazar por el logo definitivo manteniendo el mismo nombre.

## Carrusel Mundial

Subir los WebP definitivos a:

- `public/brand/competitions/world-cup/carousel/01-world-cup-2026-hero.webp`
- `public/brand/competitions/world-cup/carousel/02-world-cup-2026-stadiums.webp`
- `public/brand/competitions/world-cup/carousel/03-world-cup-2026-trophy.webp`
- `public/brand/competitions/world-cup/carousel/04-world-cup-2026-fans.webp`

Si alguno falta, `WorldCupImageCarousel` lo oculta sin bloquear la pagina.

## Escudos de ligas

- `public/brand/competitions/leagues/1-world-cup-2026.svg`
- `public/brand/competitions/leagues/128-liga-profesional-argentina.svg`

El Mundial fuerza asset local. Liga Profesional queda preparada en config, pero conserva el logo resuelto por datos existentes cuando exista.

## Escudos de torneos

- `public/brand/competitions/tournaments/copa-argentina.svg`
- `public/brand/competitions/tournaments/copa-libertadores.svg`
- `public/brand/competitions/tournaments/copa-sudamericana.svg`

Estos overrides se aplican por `tournament.key` desde `src/shared/utils/asset-urls.ts`.
