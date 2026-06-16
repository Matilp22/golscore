import SafeImage from '@/frontend/components/SafeImage'
import { PlayerPhoto, TeamLogo } from '@/frontend/components/AssetImage'
import type { Metadata } from 'next'
import Link from 'next/link'
import { buildSeoMetadata } from '@/shared/seo'

import {
  getTeamDetail,
  type TeamProfile,
  type TeamSquadPlayer,
} from '@/lib/api-football'
import { getRequestLocale } from '@/server/request-locale'
import { t } from '@/shared/i18n/locales'
import { translateCountryName } from '@/shared/utils/country-names'
import { formatPlayerHeight } from '@/shared/utils/player-profile'

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params

  try {
    const data = await getTeamDetail(Number(id), { allowApiEnrichment: false })
    const teamData = data.team as TeamProfile | null
    const team = teamData?.team
    const venue = teamData?.venue

    if (!team) {
      return buildSeoMetadata({
        title: 'Equipo no encontrado | Hay Fulbo',
        description: 'El equipo solicitado no está disponible en Hay Fulbo.',
        path: `/equipo/${id}`,
        noIndex: true,
      })
    }

    const venueText = venue?.name ? `, estadio ${venue.name}` : ''

    return buildSeoMetadata({
      title: `${team.name} | Plantel, Fixture y Estadísticas | Hay Fulbo`,
      description: `Conocé el plantel de ${team.name}, jugadores${venueText} y estadísticas del equipo en Hay Fulbo.`,
      path: `/equipo/${id}`,
    })
  } catch {
    return buildSeoMetadata({
      title: 'Equipo no disponible | Hay Fulbo',
      description: 'La ficha del equipo está temporalmente no disponible en Hay Fulbo.',
      path: `/equipo/${id}`,
      noIndex: true,
    })
  }
}

function formatCapacity(value?: number) {
  if (!value) return 'No disponible'
  return new Intl.NumberFormat('es-AR').format(value)
}

function normalizePlayerPosition(position?: string) {
  const normalized = (position || '').trim().toLowerCase()

  if (['goalkeeper', 'keeper', 'gk', 'g', 'arquero', 'portero'].includes(normalized)) {
    return 'Goalkeeper'
  }
  if (['defender', 'defence', 'defense', 'df', 'd', 'cb', 'lb', 'rb', 'defensor'].includes(normalized)) {
    return 'Defender'
  }
  if (['midfielder', 'midfield', 'mf', 'm', 'dm', 'cm', 'am', 'mediocampista', 'volante'].includes(normalized)) {
    return 'Midfielder'
  }
  if (['attacker', 'forward', 'fw', 'f', 'st', 'lw', 'rw', 'delantero'].includes(normalized)) {
    return 'Attacker'
  }

  return 'Other'
}

function translatePlayerPosition(position?: string) {
  const labels: Record<string, string> = {
    Goalkeeper: 'Arquero',
    Defender: 'Defensor',
    Midfielder: 'Mediocampista',
    Attacker: 'Delantero',
    Other: 'Posición no disponible',
  }

  return labels[normalizePlayerPosition(position)]
}

function abbreviateClubName(value?: string) {
  const name = value?.replace(/\s+/g, ' ').trim()
  if (!name) return null

  const replacements: Array<[RegExp, string]> = [
    [/^F[uú]tbol Club\s+/i, 'FC '],
    [/^Football Club\s+/i, 'FC '],
    [/^Club de F[uú]tbol\s+/i, 'CF '],
    [/^Club Atl[eé]tico\s+/i, 'CA '],
    [/^Athletic Club\s+/i, 'AC '],
    [/^Atl[eé]tico Club\s+/i, 'AC '],
    [/^Association Sportive\s+/i, 'AS '],
    [/^Associazione Calcio\s+/i, 'AC '],
    [/^Real Club Deportivo\s+/i, 'RCD '],
    [/^Sociedade Esportiva\s+/i, 'SE '],
    [/^Sporting Clube de\s+/i, 'SC '],
    [/^Sport Club\s+/i, 'SC '],
    [/^Club Deportivo\s+/i, 'CD '],
    [/^Unión Deportiva\s+/i, 'UD '],
    [/^Union Deportiva\s+/i, 'UD '],
  ]

  return replacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    name
  )
}

function groupPlayersByPosition(players: TeamSquadPlayer[]) {
  const order = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker', 'Other']
  const labels: Record<string, string> = {
    Goalkeeper: 'Arqueros',
    Defender: 'Defensores',
    Midfielder: 'Mediocampistas',
    Attacker: 'Delanteros',
    Other: 'Otros',
  }

  return order
    .map((position) => ({
      key: position,
      title: labels[position] || position,
      players: players.filter((player) => normalizePlayerPosition(player.position) === position),
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
    <div className="flex items-center justify-between gap-2 border-b border-white/6 py-2 last:border-b-0">
      <span className="text-xs text-[#8d98a7]">{label}</span>
      <span className="text-right text-xs font-semibold text-white">{value}</span>
    </div>
  )
}

function PlayerCard({
  player,
  team,
  showExtendedInfo = false,
}: {
  player: TeamSquadPlayer
  team?: {
    id?: number
    name?: string
    logo?: string
  }
  showExtendedInfo?: boolean
}) {
  const height = showExtendedInfo ? formatPlayerHeight(player.height) : null
  const clubName = showExtendedInfo ? abbreviateClubName(player.clubName) : null
  const fullClubName = player.clubName?.trim()
  const playerPhoto = player.photo_url ?? player.photo ?? player.photoUrl ?? ''
  const href = player.id
    ? `/jugador/${player.id}?${new URLSearchParams({
        name: player.name || 'Jugador',
        photo: playerPhoto,
        teamId: team?.id ? String(team.id) : '',
        teamName: team?.name || '',
        teamLogo: team?.logo || '',
      }).toString()}`
    : null
  const cardClassName =
    'flex items-center gap-2.5 rounded-xl border border-white/6 bg-black/20 px-2.5 py-2 transition hover:bg-[#70ff9d]/10'

  const content = (
    <>
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden">
        <PlayerPhoto
          player={player}
          src={player.photo_url ?? player.photo}
          alt={player.name || 'Jugador'}
          size={48}
          className="h-full w-full rounded-full object-cover"
          fallbackClassName="h-12 w-12 rounded-full"
          unoptimized
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {player.name || 'Jugador'}
        </p>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-tight text-[#8d98a7]">
          <span className="shrink-0">N° {player.number ?? '-'}</span>
          <span className="shrink-0">Edad {player.age ?? '-'}</span>
          <span className="shrink-0">{translatePlayerPosition(player.position)}</span>
          {height ? <span className="shrink-0">{height}</span> : null}
          {clubName ? (
            <span
              className="min-w-0 max-w-[11rem] truncate sm:max-w-[16rem]"
              title={fullClubName || clubName}
            >
              {clubName}
            </span>
          ) : null}
        </div>
      </div>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cardClassName}>
        {content}
      </Link>
    )
  }

  return (
    <div className={cardClassName}>
      {content}
    </div>
  )
}

export default async function EquipoPage({ params }: PageProps) {
  const { id } = await params
  const locale = await getRequestLocale()

  let data

  try {
    data = await getTeamDetail(Number(id), {
      allowApiEnrichment: true,
      deepPlayerProfileLimit: 8,
    })
  } catch {
    const message = 'Datos temporalmente no disponibles. Intentá nuevamente en unos minutos.'

    return (
      <div className="min-h-screen text-white">
        <div className="mx-0 w-full max-w-none px-0 py-3 md:mx-auto md:max-w-6xl md:px-4 md:py-10">
          <div className="w-full rounded-2xl border border-[#5a2a2a] bg-[#3b1919] p-4 md:p-6">
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
  const teamCountry = translateCountryName(team?.country, locale)
  const showExtendedSquadInfo = Boolean(
    team?.national ||
    squad.some((player) => player.height || player.clubName || player.clubLogoUrl)
  )

  if (!team) {
    return (
      <div className="min-h-screen text-white">
        <div className="mx-0 w-full max-w-none px-0 py-3 md:mx-auto md:max-w-6xl md:px-4 md:py-10">
          <div className="hf-card w-full rounded-2xl p-4 md:p-6">
            <h1 className="text-2xl font-black">Equipo no encontrado</h1>
            <p className="mt-2 text-[#8d98a7]">No existe información para este equipo.</p>
          </div>
        </div>
      </div>
    )
  }

  const teamSummary = {
    id: team.id,
    name: team.name,
    logo: team.logo_url ?? team.logo ?? team.logoUrl,
  }

  return (
    <div className="min-h-screen text-white">
      <div className="w-full max-w-none px-0 py-3 lg:mx-auto lg:max-w-7xl lg:px-5 lg:py-6">
        <header className="hf-hero mb-4 w-full overflow-hidden rounded-3xl">
          <div className="flex flex-col gap-3 px-2 py-3 md:flex-row md:items-center md:justify-between md:gap-4 md:px-4 md:py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden">
                <TeamLogo
                  team={team}
                  src={team.logo_url ?? team.logo}
                  alt={team.name}
                  size={80}
                  className="h-20 w-20 object-contain"
                  fallbackClassName="h-16 w-14"
                  unoptimized
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7ff0b2]">
                  Equipo
                </p>
                <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">
                  {team.name}
                </h1>
                <p className="mt-1 text-sm text-[#8d98a7]">
                  {teamCountry || t(locale, 'common.notAvailable')}
                </p>
              </div>
            </div>

            <div className="grid gap-2 text-sm md:grid-cols-3">
              <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2.5 md:px-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8d98a7]">Fundado</p>
                <p className="mt-1 font-semibold text-white">{team.founded || 'No disponible'}</p>
              </div>
              <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2.5 md:px-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8d98a7]">Código</p>
                <p className="mt-1 font-semibold text-white">{team.code || 'No disponible'}</p>
              </div>
              <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2.5 md:px-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8d98a7]">Estadio</p>
                <p className="mt-1 font-semibold text-white">{venue?.name || 'No disponible'}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="hf-card w-full overflow-hidden rounded-2xl">
              <div className="hf-section-head px-2 py-2 md:px-3">
                <h2 className="text-base font-bold text-white">Ficha</h2>
              </div>

              <div className="px-2 py-1 md:px-3">
                <TeamInfoRow label="País" value={teamCountry || t(locale, 'common.notAvailable')} />
                <TeamInfoRow label="Fundación" value={String(team.founded || 'No disponible')} />
                <TeamInfoRow label="Código" value={team.code || 'No disponible'} />
                <TeamInfoRow label="Estadio" value={venue?.name || 'No disponible'} />
                <TeamInfoRow label="Ciudad" value={venue?.city || 'No disponible'} />
                <TeamInfoRow label="Capacidad" value={formatCapacity(venue?.capacity)} />
                <TeamInfoRow label="Superficie" value={venue?.surface || 'No disponible'} />
              </div>
            </div>

            {venue?.image ? (
              <div className="hf-card w-full overflow-hidden rounded-2xl">
                <div className="hf-section-head px-2 py-2 md:px-3">
                  <h2 className="text-base font-bold text-white">Estadio</h2>
                </div>

                <div className="p-2 md:p-3">
                  <SafeImage
                    src={venue.image}
                    alt={venue.name || 'Estadio'}
                    imageType="venue"
                    width={600}
                    height={340}
                    className="h-auto w-full rounded-xl object-cover"
                    fallbackClassName="h-44 w-full rounded-xl"
                    unoptimized
                  />
                </div>
              </div>
            ) : null}
          </aside>

          <main className="space-y-4">
            <div className="hf-card w-full overflow-hidden rounded-2xl">
              <div className="hf-section-head px-2 py-2 md:px-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-white">Plantel</h2>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[#8d98a7]">
                    {squad.length} jugadores
                  </span>
                </div>
              </div>

              {groupedSquad.length ? (
                <div className="space-y-2.5 p-2 md:p-3">
                  {groupedSquad.map((group) => (
                    <section key={group.key} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-[#7ff0b2]" />
                        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                          {group.title}
                        </h3>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {group.players.map((player) => (
                          <PlayerCard
                            key={player.id || `${group.key}-${player.name}`}
                            player={player}
                            team={teamSummary}
                            showExtendedInfo={showExtendedSquadInfo}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="px-2 py-5 text-sm text-[#8d98a7] md:px-4">
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
