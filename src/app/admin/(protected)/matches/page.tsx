import Link from 'next/link'
import AdminCard from '@/components/admin/AdminCard'
import AdminNotice from '@/components/admin/AdminNotice'
import { saveMatchDetailsAction } from '@/app/admin/actions'
import {
  getAdminMatchesPageData,
  type AdminEditableMatch,
  type AdminMatchListMode,
} from '@/server/admin/matches'
import { formatDateTime } from '@/server/admin/shared'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type PageProps = {
  searchParams: Promise<{
    q?: string
    fixture?: string
    saved?: string
    error?: string
    view?: string
  }>
}

const MATCH_LIST_MODE_LABELS: Record<AdminMatchListMode, string> = {
  today: 'Hoy',
  'world-cup': 'Copa del Mundo',
  upcoming: 'Próximos',
  recent: 'Recientes',
  search: 'Búsqueda',
}

function normalizeMatchListMode(view: string | null | undefined, query: string): AdminMatchListMode {
  if (view === 'world-cup' || view === 'upcoming' || view === 'recent' || view === 'search') {
    return view
  }

  if (query.trim()) return 'search'

  return 'today'
}

function formatDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const byType = new Map(parts.map((part) => [part.type, part.value]))

  return `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}T${byType.get('hour')}:${byType.get('minute')}`
}

function buildMatchesPath(input: {
  query?: string
  fixture?: string
  saved?: string
  view?: AdminMatchListMode
}) {
  const params = new URLSearchParams()

  if (input.view && input.view !== 'today') params.set('view', input.view)
  if (input.query) params.set('q', input.query)
  if (input.fixture) params.set('fixture', input.fixture)
  if (input.saved) params.set('saved', input.saved)

  const queryString = params.toString()

  return `/admin/matches${queryString ? `?${queryString}` : ''}`
}

function MatchField({
  label,
  name,
  value,
  type = 'text',
  placeholder,
}: {
  label: string
  name: string
  value?: string | number | null
  type?: string
  placeholder?: string
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.08em] text-[#90a0ae]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={value ?? ''}
        placeholder={placeholder}
        className="hf-input h-11 w-full rounded-xl px-3 text-sm"
      />
    </label>
  )
}

function MatchTextarea({
  label,
  name,
  value,
  placeholder,
}: {
  label: string
  name: string
  value?: string | null
  placeholder?: string
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.08em] text-[#90a0ae]">
        {label}
      </span>
      <textarea
        name={name}
        defaultValue={value ?? ''}
        placeholder={placeholder}
        rows={2}
        className="hf-input min-h-20 w-full rounded-xl px-3 py-2 text-sm"
      />
    </label>
  )
}

function MatchSelector({
  fixtures,
  selectedFixtureId,
  query,
  mode,
}: {
  fixtures: AdminEditableMatch[]
  selectedFixtureId: string | null
  query: string
  mode: AdminMatchListMode
}) {
  if (!fixtures.length) {
    return (
      <div className="rounded-xl border border-white/8 bg-black/10 p-3 text-sm text-[#9aa7b5]">
        <p>No hay partidos para ese filtro.</p>
        {mode === 'today' ? (
          <p className="mt-2 text-xs">
            Si esperabas ver partidos de hoy, revisá que el sync del día esté ejecutado.
          </p>
        ) : null}
        {mode === 'world-cup' ? (
          <p className="mt-2 text-xs">
            Si faltan partidos del Mundial, corré el sync de la Copa del Mundo o buscá por fixture id.
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
      {fixtures.map((fixture) => {
        const active = fixture.fixtureExternalId === selectedFixtureId
        const label = `${fixture.homeTeam ?? 'Local'} vs ${fixture.awayTeam ?? 'Visitante'}`

        return (
          <Link
            key={fixture.cacheId}
            href={buildMatchesPath({ query, fixture: fixture.fixtureExternalId, view: mode })}
            className={`block rounded-xl border px-3 py-2 transition ${
              active
                ? 'border-[#70ff9d]/35 bg-[#123022]/80 text-white'
                : 'border-white/8 bg-black/10 text-[#dce7f2] hover:border-[#70ff9d]/20 hover:bg-[#111b18]'
            }`}
          >
            <p className="truncate text-sm font-black">{label}</p>
            <p className="mt-1 truncate text-xs text-[#9aa7b5]">
              {fixture.leagueName ?? 'Liga sin dato'} - Fixture {fixture.fixtureExternalId}
            </p>
            <p className="mt-1 text-xs text-[#7ff0b2]">
              {formatDateTime(fixture.date ?? fixture.matchDate)}
            </p>
          </Link>
        )
      })}
    </div>
  )
}

function MatchEditor({
  match,
  returnPath,
}: {
  match: AdminEditableMatch
  returnPath: string
}) {
  return (
    <form action={saveMatchDetailsAction} className="space-y-4">
      <input type="hidden" name="fixtureExternalId" value={match.fixtureExternalId} />
      <input type="hidden" name="returnPath" value={returnPath} />

      <div className="rounded-xl border border-white/8 bg-black/10 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black text-white">
              {match.homeTeam ?? 'Local'} vs {match.awayTeam ?? 'Visitante'}
            </p>
            <p className="mt-1 text-xs text-[#9aa7b5]">
              Fixture {match.fixtureExternalId} - {match.leagueName ?? 'Liga sin dato'} - {formatDateTime(match.date)}
            </p>
          </div>
          <Link
            href={`/partido/${match.fixtureExternalId}`}
            className="hf-button-secondary inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-black"
          >
            Ver detalle
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#70ff9d]">
          Partido
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MatchField label="Fecha y hora" name="date" type="datetime-local" value={formatDateTimeLocalValue(match.date)} />
          <MatchField label="Estado corto" name="statusShort" value={match.statusShort} placeholder="NS, 1H, HT, FT" />
          <MatchField label="Estado visible" name="statusLong" value={match.statusLong} placeholder="No iniciado, Final..." />
          <MatchField label="Minuto" name="minute" type="number" value={match.minute} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MatchField label="Liga" name="leagueName" value={match.leagueName} />
          <MatchField label="ID liga externa" name="leagueExternalId" value={match.leagueExternalId} />
          <MatchField label="Pais" name="country" value={match.country} />
          <MatchField label="Temporada" name="season" type="number" value={match.season} />
        </div>
        <MatchField label="Fecha / fase / ronda" name="round" value={match.round} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#70ff9d]">
          Equipos y resultado
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <MatchField label="Local" name="homeTeam" value={match.homeTeam} />
          <MatchField label="Visitante" name="awayTeam" value={match.awayTeam} />
          <MatchTextarea label="Logo local" name="homeLogo" value={match.homeLogo} />
          <MatchTextarea label="Logo visitante" name="awayLogo" value={match.awayLogo} />
        </div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <MatchField label="Goles local" name="goalsHome" type="number" value={match.goalsHome} />
          <MatchField label="Goles visitante" name="goalsAway" type="number" value={match.goalsAway} />
          <MatchField label="Penal local" name="homePenaltyScore" type="number" value={match.homePenaltyScore} />
          <MatchField label="Penal visitante" name="awayPenaltyScore" type="number" value={match.awayPenaltyScore} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#70ff9d]">
          Detalle publico
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          <MatchField label="Estadio" name="venueName" value={match.venueName} />
          <MatchField label="Ciudad" name="venueCity" value={match.venueCity} />
          <MatchField label="Arbitro" name="referee" value={match.referee} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <MatchField label="TV" name="tv" value={match.tv} placeholder="TV Publica / TyC Sports..." />
          <MatchTextarea label="Logo TV" name="broadcastLogoUrl" value={match.broadcastLogoUrl} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#70ff9d]">
          Resumen
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <MatchTextarea label="URL resumen" name="highlightsUrl" value={match.highlightsUrl} placeholder="YouTube, embed o video soportado" />
          <MatchField label="Titulo resumen" name="highlightsTitle" value={match.highlightsTitle} />
        </div>
      </section>

      <div className="sticky bottom-3 z-10 rounded-2xl border border-white/8 bg-[#07110f]/95 p-3 shadow-[0_16px_50px_rgba(0,0,0,0.35)] backdrop-blur">
        <button className="hf-button h-11 w-full rounded-xl px-4 text-sm font-black sm:w-auto" type="submit">
          Guardar cambios
        </button>
        <p className="mt-2 text-xs text-[#9aa7b5]">
          Guarda cache normalizado y, si existe, la fila persistida de matches.
        </p>
      </div>
    </form>
  )
}

export default async function AdminMatchesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = params.q ?? ''
  const mode = normalizeMatchListMode(params.view, query)
  const selectedFixtureId = params.fixture ?? null
  const pageResult = await getAdminMatchesPageData(query, selectedFixtureId, mode)
  const { fixtures, selectedMatch } = pageResult.data
  const activeFixtureId = selectedMatch?.fixtureExternalId ?? selectedFixtureId
  const returnPath = buildMatchesPath({ query, fixture: activeFixtureId ?? undefined, view: mode })
  const modes: AdminMatchListMode[] = ['today', 'world-cup', 'upcoming', 'recent']

  return (
    <div className="space-y-4">
      {params.saved ? (
        <AdminNotice
          title="Cambios guardados"
          message="El partido fue actualizado y las rutas principales quedaron revalidadas."
        />
      ) : null}

      {params.error ? (
        <AdminNotice
          title="No se pudo guardar"
          message={params.error}
          tone="danger"
        />
      ) : null}

      {pageResult.error ? (
        <AdminNotice
          title={pageResult.error.setupRequired ? 'SQL pendiente' : 'Error de datos'}
          message={pageResult.error.message}
          tone="danger"
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <AdminCard
          title="Partidos"
          description={`Filtro activo: ${MATCH_LIST_MODE_LABELS[mode]}. Busca un fixture cacheado y elegilo para editar sus datos visibles.`}
        >
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
            {modes.map((item) => {
              const active = item === mode

              return (
                <Link
                  key={item}
                  href={buildMatchesPath({ view: item })}
                  className={`inline-flex min-h-10 items-center justify-center rounded-xl border px-3 text-center text-xs font-black transition ${
                    active
                      ? 'border-[#70ff9d]/40 bg-[#123022] text-white'
                      : 'border-white/8 bg-black/10 text-[#cbd7e3] hover:border-[#70ff9d]/25'
                  }`}
                >
                  {MATCH_LIST_MODE_LABELS[item]}
                </Link>
              )
            })}
          </div>

          <form className="mb-4 flex flex-col gap-2 sm:flex-row xl:flex-col" action="/admin/matches">
            <input type="hidden" name="view" value={mode} />
            <input
              name="q"
              defaultValue={query}
              placeholder="Equipo, liga o fixture id"
              className="hf-input h-11 flex-1 rounded-xl px-3 text-sm"
            />
            <button className="hf-button h-11 rounded-xl px-4 text-sm font-black" type="submit">
              Buscar
            </button>
          </form>

          <MatchSelector
            fixtures={fixtures}
            selectedFixtureId={activeFixtureId}
            query={query}
            mode={mode}
          />
        </AdminCard>

        <AdminCard
          title="Editar detalle del partido"
          description="Datos usados por home, liga y pantalla de detalle cuando el fixture esta cacheado."
        >
          {selectedMatch ? (
            <MatchEditor match={selectedMatch} returnPath={returnPath} />
          ) : (
            <p className="text-sm text-[#9aa7b5]">
              Selecciona un partido para editarlo.
            </p>
          )}
        </AdminCard>
      </div>
    </div>
  )
}
