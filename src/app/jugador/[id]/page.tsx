import { PlayerPhoto } from '@/frontend/components/AssetImage'
import PlayerIncidentsList from '@/frontend/components/PlayerIncidentsList'
import {
  ApiFootballError,
  getPlayerDetail,
  type LeaderStatType,
} from '@/lib/api-football'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    leagueId?: string
    season?: string
    statType?: string
    expectedCount?: string
    name?: string
    photo?: string
    teamId?: string
    teamName?: string
    teamLogo?: string
  }>
}

function isLeaderStatType(value?: string): value is LeaderStatType {
  return (
    value === 'scorers' ||
    value === 'assists' ||
    value === 'yellowCards' ||
    value === 'redCards'
  )
}

function formatDate(value?: string) {
  if (!value) return 'No disponible'

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatMinutes(value: number) {
  return new Intl.NumberFormat('es-AR').format(value)
}

function formatPosition(value?: string | null) {
  if (!value) return 'No disponible'

  const normalized = value.trim().toLowerCase()

  if (normalized === 'goalkeeper') return 'Arquero'
  if (normalized === 'defender') return 'Defensor'
  if (normalized === 'midfielder') return 'Mediocampista'
  if (normalized === 'attacker') return 'Delantero'

  return value
}

function formatRating(value?: string | null) {
  return value || 'No disponible'
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-white/6 py-2 last:border-b-0">
      <span className="text-xs text-[#8d98a7]">{label}</span>
      <span className="text-right text-xs font-semibold text-white">{value}</span>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent: string
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-[#161a20] px-2 py-2.5 md:px-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8d98a7]">{label}</p>
      <p className={`mt-1 text-xl font-black ${accent}`}>{value}</p>
    </div>
  )
}

export default async function JugadorPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const query = await searchParams
  const playerId = Number(id)
  const leagueId = Number(query.leagueId)
  const season = Number(query.season)
  const statType = isLeaderStatType(query.statType) ? query.statType : 'scorers'
  const expectedCount = Number(query.expectedCount) || undefined
  const fallbackName = query.name || 'Jugador'
  const fallbackPhoto = query.photo || undefined
  const fallbackTeamId = Number(query.teamId) || undefined
  const fallbackTeamName = query.teamName || undefined
  const fallbackTeamLogo = query.teamLogo || undefined

  if (!playerId || !season) {
    return (
      <div className="min-h-screen text-white">
        <div className="mx-0 w-full max-w-none px-0 py-3 md:mx-auto md:max-w-6xl md:px-4 md:py-10">
          <div className="w-full rounded-2xl border border-[#5a2a2a] bg-[#3b1919] p-4 md:p-6">
            <h1 className="text-2xl font-black">Jugador no disponible</h1>
            <p className="mt-2 text-[#ffd5d5]">
              Faltan datos para mostrar la ficha del jugador.
            </p>
          </div>
        </div>
      </div>
    )
  }

  try {
    const playerDetail = await getPlayerDetail(playerId, season, leagueId || undefined)

    const player = playerDetail?.player || {
      id: playerId,
      name: fallbackName,
      photo: fallbackPhoto,
    }
    const team = playerDetail?.team || {
      id: fallbackTeamId,
      name: fallbackTeamName,
      logo: fallbackTeamLogo,
    }
    const league = playerDetail?.league
    const statistics = playerDetail?.statistics || {
      appearances: 0,
      lineups: 0,
      minutes: 0,
      position: null,
      rating: null,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    }

    return (
      <div className="min-h-screen text-white">
        <div className="w-full max-w-none px-0 py-3 lg:mx-auto lg:max-w-7xl lg:px-5 lg:py-6">
          <header className="mb-4 w-full overflow-hidden rounded-2xl border border-white/8 bg-[#111418]/95 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
            <div className="flex flex-col gap-3 px-2 py-3 md:flex-row md:items-center md:justify-between md:gap-4 md:px-4 md:py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden">
                  <PlayerPhoto
                    src={player.photo}
                    alt={player.name}
                    size={80}
                    className="h-20 w-20 rounded-full object-cover"
                    fallbackClassName="h-20 w-20 rounded-full"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7ff0b2]">
                    Jugador
                  </p>
                  <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">
                    {player.name}
                  </h1>
                  <p className="mt-1 text-sm text-[#8d98a7]">
                    {team?.name || 'Sin equipo'}
                    {league?.name ? ` · ${league.name}` : ''}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 text-sm md:grid-cols-3">
                <SummaryStat label="Goles" value={statistics.goals} accent="text-[#7ff0b2]" />
                <SummaryStat
                  label="Asistencias"
                  value={statistics.assists}
                  accent="text-sky-300"
                />
                <SummaryStat
                  label="Tarjetas"
                  value={`${statistics.yellowCards}/${statistics.redCards}`}
                  accent="text-[#f3d36c]"
                />
              </div>
            </div>
          </header>

          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0f1317]/92">
                <div className="border-b border-white/6 bg-[#13181d] px-2 py-2 md:px-3">
                  <h2 className="text-base font-bold text-white">Ficha</h2>
                </div>

                <div className="px-2 py-1 md:px-3">
                  <InfoRow label="Edad" value={String(player.age || 'No disponible')} />
                  <InfoRow label="Nacionalidad" value={player.nationality || 'No disponible'} />
                  <InfoRow label="Nacimiento" value={formatDate(player.birthDate)} />
                  <InfoRow
                    label="Lugar"
                    value={
                      [player.birthPlace, player.birthCountry].filter(Boolean).join(', ') ||
                      'No disponible'
                    }
                  />
                  <InfoRow label="Altura" value={player.height || 'No disponible'} />
                  <InfoRow label="Peso" value={player.weight || 'No disponible'} />
                  <InfoRow label="Lesionado" value={player.injured ? 'Sí' : 'No'} />
                </div>
              </div>

              <div className="w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0f1317]/92">
                <div className="border-b border-white/6 bg-[#13181d] px-2 py-2 md:px-3">
                  <h2 className="text-base font-bold text-white">Temporada</h2>
                </div>

                <div className="px-2 py-1 md:px-3">
                  <InfoRow label="Competencia" value={league?.name || 'No disponible'} />
                  <InfoRow label="País" value={league?.country || 'No disponible'} />
                  <InfoRow label="Apariciones" value={String(statistics.appearances)} />
                  <InfoRow label="Titular" value={String(statistics.lineups)} />
                  <InfoRow label="Minutos" value={formatMinutes(statistics.minutes)} />
                  <InfoRow label="Posición" value={formatPosition(statistics.position)} />
                  <InfoRow label="Valoración" value={formatRating(statistics.rating)} />
                </div>
              </div>
            </aside>

            <main className="space-y-4">
              <PlayerIncidentsList
                leagueId={leagueId || undefined}
                season={season}
                playerId={playerId}
                playerName={fallbackName}
                teamId={team?.id}
                expectedCount={expectedCount}
                tournamentName={league?.name}
                statType={statType}
              />
            </main>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    const message =
      error instanceof ApiFootballError
        ? error.message
        : 'No se pudo cargar la información del jugador.'

    return (
      <div className="min-h-screen text-white">
        <div className="mx-0 w-full max-w-none px-0 py-3 md:mx-auto md:max-w-6xl md:px-4 md:py-10">
          <div className="w-full rounded-2xl border border-[#5a2a2a] bg-[#3b1919] p-4 md:p-6">
            <h1 className="text-2xl font-black">Jugador no disponible</h1>
            <p className="mt-2 text-[#ffd5d5]">{message}</p>
          </div>
        </div>
      </div>
    )
  }
}
