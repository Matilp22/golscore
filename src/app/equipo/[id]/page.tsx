import Image from 'next/image'

import {
  ApiFootballError,
  getTeamDetail,
  type TeamProfile,
  type TeamSquadPlayer,
} from '@/lib/api-football'

type PageProps = {
  params: Promise<{ id: string }>
}

function formatCapacity(value?: number) {
  if (!value) return 'No disponible'
  return new Intl.NumberFormat('es-AR').format(value)
}

function groupPlayersByPosition(players: TeamSquadPlayer[]) {
  const order = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker']
  const labels: Record<string, string> = {
    Goalkeeper: 'Arqueros',
    Defender: 'Defensores',
    Midfielder: 'Mediocampistas',
    Attacker: 'Delanteros',
  }

  return order
    .map((position) => ({
      key: position,
      title: labels[position] || position,
      players: players.filter((player) => player.position === position),
    }))
    .filter((group) => group.players.length > 0)
}

function TeamInfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/6 py-3 last:border-b-0">
      <span className="text-sm text-[#8d98a7]">{label}</span>
      <span className="text-right text-sm font-semibold text-white">{value}</span>
    </div>
  )
}

function PlayerCard({ player }: { player: TeamSquadPlayer }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/6 bg-[#161a20] px-3 py-3">
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#0f1317] ring-1 ring-white/6">
        {player.photo ? (
          <Image
            src={player.photo}
            alt={player.name || 'Jugador'}
            width={48}
            height={48}
            className="h-12 w-12 object-cover"
          />
        ) : (
          <span className="text-xs text-[#6f7a87]">Sin foto</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {player.name || 'Jugador'}
        </p>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#8d98a7]">
          <span>N° {player.number ?? '-'}</span>
          <span>Edad {player.age ?? '-'}</span>
        </div>
      </div>
    </div>
  )
}

export default async function EquipoPage({ params }: PageProps) {
  const { id } = await params

  let data

  try {
    data = await getTeamDetail(Number(id))
  } catch (error) {
    const message =
      error instanceof ApiFootballError
        ? error.code === 'requests'
          ? 'Se alcanzó el límite diario de la API. La ficha del equipo no pudo cargarse.'
          : error.message
        : 'No se pudo cargar la información del equipo.'

    return (
      <div className="min-h-screen text-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-[#5a2a2a] bg-[#3b1919] p-6">
            <h1 className="text-2xl font-black">Equipo no disponible</h1>
            <p className="mt-2 text-[#ffd5d5]">{message}</p>
          </div>
        </div>
      </div>
    )
  }

  const teamData = data.team as TeamProfile | null
  const team = teamData?.team
  const venue = teamData?.venue
  const squad = data.squad?.players || []
  const groupedSquad = groupPlayersByPosition(squad)

  if (!team) {
    return (
      <div className="min-h-screen text-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-white/8 bg-[#111418] p-6">
            <h1 className="text-2xl font-black">Equipo no encontrado</h1>
            <p className="mt-2 text-[#8d98a7]">No existe información para este equipo.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-3 py-4 md:px-5 md:py-6">
        <header className="mb-4 overflow-hidden rounded-2xl border border-white/8 bg-[#111418]/95 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
          <div className="flex flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#161a20] ring-1 ring-white/6">
                {team.logo ? (
                  <Image
                    src={team.logo}
                    alt={team.name}
                    width={80}
                    height={80}
                    className="h-20 w-20 object-contain"
                  />
                ) : (
                  <span className="text-sm text-[#6f7a87]">Sin logo</span>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7ff0b2]">
                  Equipo
                </p>
                <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">
                  {team.name}
                </h1>
                <p className="mt-1 text-sm text-[#8d98a7]">
                  {team.country || 'País no disponible'}
                </p>
              </div>
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-xl border border-white/6 bg-[#161a20] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8d98a7]">Fundado</p>
                <p className="mt-1 font-semibold text-white">{team.founded || 'No disponible'}</p>
              </div>
              <div className="rounded-xl border border-white/6 bg-[#161a20] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8d98a7]">Código</p>
                <p className="mt-1 font-semibold text-white">{team.code || 'No disponible'}</p>
              </div>
              <div className="rounded-xl border border-white/6 bg-[#161a20] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8d98a7]">Estadio</p>
                <p className="mt-1 font-semibold text-white">{venue?.name || 'No disponible'}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0f1317]/92">
              <div className="border-b border-white/6 bg-[#13181d] px-4 py-3">
                <h2 className="text-base font-bold text-white">Ficha</h2>
              </div>

              <div className="px-4 py-1">
                <TeamInfoRow label="País" value={team.country || 'No disponible'} />
                <TeamInfoRow label="Fundación" value={String(team.founded || 'No disponible')} />
                <TeamInfoRow label="Estadio" value={venue?.name || 'No disponible'} />
                <TeamInfoRow label="Ciudad" value={venue?.city || 'No disponible'} />
                <TeamInfoRow label="Capacidad" value={formatCapacity(venue?.capacity)} />
                <TeamInfoRow label="Superficie" value={venue?.surface || 'No disponible'} />
              </div>
            </div>

            {venue?.image ? (
              <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0f1317]/92">
                <div className="border-b border-white/6 bg-[#13181d] px-4 py-3">
                  <h2 className="text-base font-bold text-white">Estadio</h2>
                </div>

                <div className="p-4">
                  <Image
                    src={venue.image}
                    alt={venue.name || 'Estadio'}
                    width={600}
                    height={340}
                    className="h-auto w-full rounded-xl object-cover"
                  />
                </div>
              </div>
            ) : null}
          </aside>

          <main className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0f1317]/92">
              <div className="border-b border-white/6 bg-[#13181d] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-white">Plantel</h2>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-[#8d98a7]">
                    {squad.length} jugadores
                  </span>
                </div>
              </div>

              {groupedSquad.length ? (
                <div className="space-y-4 p-4">
                  {groupedSquad.map((group) => (
                    <section key={group.key} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-[#7ff0b2]" />
                        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                          {group.title}
                        </h3>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {group.players.map((player) => (
                          <PlayerCard key={player.id || `${group.key}-${player.name}`} player={player} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-5 text-sm text-[#8d98a7]">
                  No hay plantel disponible para este equipo.
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
