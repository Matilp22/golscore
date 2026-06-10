# FulboApp

FulboApp es una app web de resultados de futbol construida con Next.js. La experiencia esta pensada para seguir partidos del dia con una estructura editorial inspirada en Promiedos, pero con una interfaz mas limpia, compacta y enfocada en el detalle de partido.

Hoy el proyecto ya incluye:

- Home por fecha con secciones futboleras curadas.
- Agrupacion de partidos por pais o bloque competitivo.
- Detalle de partido con minuto a minuto, estadisticas y formaciones.
- Ficha de equipo con informacion del club, estadio y plantel.
- Auth con Supabase y base funcional de prode en `/prode`.
- Predicciones por usuario, bloqueo 15 minutos antes del partido y ranking.
- Migraciones, seed y Supabase Edge Functions para sincronizacion y puntos.
- Consumo server-side de API-Football con cache y deduplicacion de requests.
- Refresco manual y autorefresco controlado para no castigar la cuota de la API.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth/Postgres para auth, predicciones y ranking
- API-Football como proveedor de datos
- YouTube Data API para resumenes/highlights server-side

## Requisitos

- Node.js 20 o superior recomendado
- Una API key valida de API-Football
- Una API key valida de YouTube Data API si se quieren cargar highlights automaticos

## Variables de entorno

Crear un archivo `.env.local` en la raiz del proyecto con:

```env
FOOTBALL_API_KEY=tu_api_key
FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
YOUTUBE_API_KEY=tu_youtube_data_api_key
NEXT_PUBLIC_SUPABASE_URL=https://gzqapeavjpzgmdhrizqy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

La app consume API-Football y YouTube solo desde el servidor. Las keys no se exponen al cliente. La URL de Supabase debe ser la base del proyecto, sin `/rest/v1`.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start
```

## Desarrollo local

1. Instalar dependencias:

```bash
npm install
```

2. Configurar `.env.local` con `API_FOOTBALL_KEY`.

Para probar el prode tambien hace falta cargar:

```env
NEXT_PUBLIC_SUPABASE_URL=https://gzqapeavjpzgmdhrizqy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

3. Levantar el entorno de desarrollo:

```bash
npm run dev
```

4. Abrir [http://localhost:3000](http://localhost:3000).

## Estructura principal

```text
src/
  app/
    page.tsx                Home de partidos por fecha
    partido/[id]/page.tsx   Detalle de partido
    equipo/[id]/page.tsx    Ficha de equipo
    liga/[id]/page.tsx      Vista de torneos
    prode/page.tsx          Prode, predicciones y ranking
    api/                    Endpoints internos
  frontend/
    components/
    hooks/
    services/
    types/
  lib/
    supabase/               Clientes Supabase
  server/
    integrations/           API-Football server-side
    cache/                  Cache persistente
    prode/                  Reglas y servicios seguros del prode
  shared/
    config/                 Configuracion reutilizable
supabase/
  migrations/
  functions/
docs/
  arquitectura.md
  base-de-datos.md
  deploy.md
  endpoints.md
  variables-entorno.md
```

## Como esta armada la app

### Home

La home resuelve el dia futbolero con tres decisiones centrales:

- Usa la zona horaria `America/Argentina/Buenos_Aires` para calcular fecha y horarios.
- Reordena las fixtures de la API en secciones fijas como Argentina, Internacional, Inglaterra o Selecciones.
- Prioriza legibilidad: partidos en vivo primero, laterales simples y bloques de competicion faciles de escanear.

### Detalle de partido

La vista de partido busca responder rapido lo importante:

- Estado, resultado y contexto del encuentro.
- Minuto a minuto con iconografia por tipo de evento.
- Formaciones y once en cancha.
- Estadisticas comparativas.
- Enlaces a la ficha de cada equipo.

### Capa de datos

`src/server/integrations/api-football.ts` centraliza el consumo del proveedor:

- Usa `fetch` server-side.
- Agrega TTL configurable por tipo de consulta.
- Deduplica requests identicos en vuelo.
- Traduce errores de la API a mensajes mas claros para la UI.

### Prode

La ruta `/prode` esta conectada a Supabase y permite:

- Iniciar sesion y recuperar usuario actual con Supabase Auth.
- Ver ligas, filtrar partidos y consultar predicciones propias.
- Guardar una prediccion por usuario y partido.
- Bloquear cambios cuando faltan menos de 15 minutos para el inicio.
- Ver resumen de puntos y leaderboard publico.

La regla de puntos es:

- 3 puntos por marcador exacto.
- 1 punto por ganador o empate correcto.
- 0 puntos si el pronostico es incorrecto.

La logica sensible vive en `src/server/prode`, route handlers y Supabase. El trigger SQL replica el bloqueo para que no dependa solo del frontend.

## Estado actual

- Home, detalle de partido y detalle de equipo estan integrados con datos reales.
- `/prode` esta implementado como base funcional con Auth, predicciones, bloqueo horario y ranking.
- Supabase tiene migraciones, RLS, seed de prueba y Edge Functions en `supabase/`.
- La ruta `/liga/[id]` sigue en modo prototipo con datos hardcodeados.
- El archivo `docs/decisiones.md` documenta la evolucion de producto y varias decisiones de UI.

## Proximos pasos sugeridos

- Cargar `NEXT_PUBLIC_SUPABASE_ANON_KEY` real en `.env.local` y Vercel.
- Ejecutar `supabase db push` y cargar `supabase/seed.sql` si se quiere probar con datos iniciales.
- Configurar redirect URLs de Supabase Auth y desplegar las Edge Functions.
- Cargar secrets de Supabase Functions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_API_KEY` y `CRON_SECRET`.
- Llevar `/liga/[id]` a datos reales o retirarla temporalmente del flujo principal.
- Seguir extrayendo helpers de traduccion y presentacion desde las paginas grandes.
- Sumar tests para reglas de agrupacion y traducciones de estado.
- Evaluar endpoints internos propios si queres desacoplar aun mas la UI del proveedor externo.

## Notas

- Si la cuota diaria de API-Football se agota, la app muestra mensajes de error especificos.
- Algunas vistas dependen de la calidad de datos del proveedor, especialmente colores de equipo, alineaciones y eventos.
