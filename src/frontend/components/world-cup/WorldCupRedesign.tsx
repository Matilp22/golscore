import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { PlayerPhoto, TeamLogo } from '@/frontend/components/AssetImage'
import type {
  LeagueFixtureSummary,
  LeagueStandingGroup,
  TopPlayerRow,
} from '@/lib/api-football'
import {
  addDaysToISO,
  formatMatchTimeArgentina,
  getArgentinaDateISO,
  getArgentinaTodayISO,
  toArgentinaDate,
} from '@/shared/utils/argentina-time'
import { translateCountryName } from '@/shared/utils/country-names'
import {
  formatMatchScoreWithPenalties,
  formatMatchStatusUnderScore,
} from '@/shared/utils/match-display'
import {
  isFinishedStatus,
  isLiveStatus,
  isPostponedStatus,
  isUpcomingStatus,
} from '@/shared/utils/match-status'
import { getWorldCupGroupKey, WORLD_CUP_GROUP_KEYS } from '@/shared/utils/world-cup-groups'
import type { AppLocale } from '@/shared/i18n/locales'

type WorldCupRedesignProps = {
  title: string
  subtitle: string
  fixtures: LeagueFixtureSummary[]
  standings: LeagueStandingGroup[]
  scorers: TopPlayerRow[]
  locale: AppLocale
  errorMessage?: string | null
  hasTournamentData: boolean
  bracketSection?: ReactNode
  groupStageSection?: ReactNode
  leaderStatsSection?: ReactNode
}

type IconName =
  | 'home'
  | 'live'
  | 'calendar'
  | 'clock'
  | 'shield'
  | 'chart'
  | 'bracket'
  | 'news'
  | 'trophy'
  | 'search'
  | 'menu'
  | 'user'
  | 'bell'
  | 'play'
  | 'more'
  | 'pin'

const HF_LOGO_SRC = '/brand/hf-logo.png'
const WORLD_CUP_TROPHY_SRC = '/brand/competitions/world-cup-trophy-cutout.png'
const TODAY_FIXTURE_LIMIT = 4

const sidebarItems: Array<{ label: string; href: string; icon: IconName; active?: boolean; badge?: string }> = [
  { label: 'Mundial', href: '#mundial', icon: 'home', active: true },
  { label: 'En vivo', href: '#partidos', icon: 'live' },
  { label: 'Proximos', href: '#partidos', icon: 'calendar' },
  { label: 'Finalizados', href: '#partidos', icon: 'clock' },
  { label: 'Equipos', href: '#mundial-grupos', icon: 'shield' },
  { label: 'Posiciones', href: '#posiciones', icon: 'chart' },
  { label: 'Estadisticas', href: '#goleadores', icon: 'chart' },
  { label: 'Llaves', href: '#llaves', icon: 'bracket' },
  { label: 'Noticias', href: '#noticias', icon: 'news' },
  { label: 'Prode', href: '/prode', icon: 'trophy', badge: 'Nuevo' },
]

const mobileQuickItems: Array<{ label: string; href: string; icon: IconName; active?: boolean }> = [
  { label: 'En vivo', href: '#partidos', icon: 'live', active: true },
  { label: 'Proximos', href: '#partidos', icon: 'calendar' },
  { label: 'Posiciones', href: '#posiciones', icon: 'chart' },
  { label: 'Equipos', href: '#mundial-grupos', icon: 'shield' },
  { label: 'Mas', href: '#llaves', icon: 'more' },
]

const mobileBottomItems: Array<{ label: string; href: string; icon: IconName; active?: boolean }> = [
  { label: 'Inicio', href: '/', icon: 'home', active: true },
  { label: 'Prode', href: '/prode', icon: 'trophy' },
  { label: 'Equipos', href: '#mundial-grupos', icon: 'shield' },
  { label: 'Posiciones', href: '#posiciones', icon: 'chart' },
  { label: 'En vivo', href: '#partidos', icon: 'live' },
]

const tabs = ['Fase de grupos', 'Posiciones', 'Goleadores', 'Equipos', 'Sedes', 'Historia']

function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
  }

  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.4Z" />
      </svg>
    )
  }

  if (name === 'live') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M8 8.5a5 5 0 0 0 0 7M16 8.5a5 5 0 0 1 0 7M5 5a9.6 9.6 0 0 0 0 14M19 5a9.6 9.6 0 0 1 0 14" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      </svg>
    )
  }

  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
        <path {...common} d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" />
      </svg>
    )
  }

  if (name === 'clock') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <circle {...common} cx="12" cy="12" r="8" />
        <path {...common} d="M12 8v4l3 2" />
      </svg>
    )
  }

  if (name === 'shield') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M12 3 19 6v5c0 4.4-2.7 7.5-7 10-4.3-2.5-7-5.6-7-10V6l7-3Z" />
      </svg>
    )
  }

  if (name === 'chart') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M5 20V10M12 20V4M19 20v-7M3 20h18" />
      </svg>
    )
  }

  if (name === 'bracket') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M6 5h5v5H6zM6 14h5v5H6zM13 7.5h3a2 2 0 0 1 2 2V12M13 16.5h3a2 2 0 0 0 2-2V12M18 12h2" />
      </svg>
    )
  }

  if (name === 'news') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M5 5h11a2 2 0 0 1 2 2v12H7a3 3 0 0 1-3-3V6a1 1 0 0 1 1-1Z" />
        <path {...common} d="M18 9h2v7a3 3 0 0 1-3 3M8 9h6M8 13h6M8 17h3" />
      </svg>
    )
  }

  if (name === 'trophy') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M8 4h8v4a4 4 0 0 1-8 0V4ZM10 14h4v4h3v2H7v-2h3v-4Z" />
        <path {...common} d="M8 6H5a3 3 0 0 0 3 5M16 6h3a3 3 0 0 1-3 5" />
      </svg>
    )
  }

  if (name === 'search') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <circle {...common} cx="11" cy="11" r="6" />
        <path {...common} d="m16 16 4 4" />
      </svg>
    )
  }

  if (name === 'menu') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    )
  }

  if (name === 'user') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <circle {...common} cx="12" cy="8" r="3.5" />
        <path {...common} d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    )
  }

  if (name === 'bell') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M18 10a6 6 0 0 0-12 0c0 6-2 6-2 8h16c0-2-2-2-2-8Z" />
        <path {...common} d="M10 21h4" />
      </svg>
    )
  }

  if (name === 'play') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M8 5v14l11-7-11-7Z" />
      </svg>
    )
  }

  if (name === 'pin') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M12 21s7-6.1 7-12A7 7 0 0 0 5 9c0 5.9 7 12 7 12Z" />
        <circle {...common} cx="12" cy="9" r="2.5" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path {...common} d="M5 12h.01M12 12h.01M19 12h.01" />
    </svg>
  )
}

function getFixtureTimestamp(fixture: Pick<LeagueFixtureSummary, 'date'>) {
  if (!fixture.date) return Number.MAX_SAFE_INTEGER

  const timestamp = toArgentinaDate(fixture.date).getTime()
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER
}

function sortFixturesByDate(fixtures: LeagueFixtureSummary[]) {
  return [...fixtures].sort((a, b) => {
    const dateDiff = getFixtureTimestamp(a) - getFixtureTimestamp(b)
    if (dateDiff !== 0) return dateDiff

    return String(a.id).localeCompare(String(b.id), 'es-AR', { numeric: true })
  })
}

function hasScore(fixture: LeagueFixtureSummary) {
  return fixture.goalsHome !== null && fixture.goalsAway !== null
}

function getFixtureScore(fixture: LeagueFixtureSummary) {
  return formatMatchScoreWithPenalties({
    goalsHome: fixture.goalsHome,
    goalsAway: fixture.goalsAway,
    homePenaltyScore: fixture.homePenaltyScore,
    awayPenaltyScore: fixture.awayPenaltyScore,
  })
}

function getTeamName(name: string, locale: AppLocale) {
  return translateCountryName(name, locale) || name
}

function getFixtureGroupLabel(fixture: LeagueFixtureSummary) {
  const groupKey = getWorldCupGroupKey(fixture.round)
  return groupKey ? `Grupo ${groupKey}` : 'Mundial 2026'
}

function getFixtureRoundLabel(fixture: LeagueFixtureSummary) {
  const normalized = fixture.round.toLowerCase()
  const matchday = normalized.match(/\b(?:round|fecha|matchday|jornada)\s*[-:]?\s*(\d{1,2})\b/)
  const trailing = normalized.match(/-\s*(\d{1,2})\s*$/)
  const roundNumber = matchday?.[1] ?? trailing?.[1]

  return roundNumber ? `Fecha ${roundNumber}` : 'Fecha'
}

function getFixtureMeta(fixture: LeagueFixtureSummary) {
  return `${getFixtureGroupLabel(fixture)} - ${getFixtureRoundLabel(fixture)}`
}

function getFixtureDayText(fixture: LeagueFixtureSummary) {
  if (!fixture.date) return 'A confirmar'

  const today = getArgentinaTodayISO()
  const fixtureDate = getArgentinaDateISO(fixture.date)

  if (fixtureDate === today) return 'Hoy'
  if (fixtureDate === addDaysToISO(today, -1)) return 'Ayer'
  if (fixtureDate === addDaysToISO(today, 1)) return 'Manana'

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: 'short',
  }).format(toArgentinaDate(fixture.date))
}

function getMatchCenterLabel(fixture: LeagueFixtureSummary) {
  if (hasScore(fixture)) return getFixtureScore(fixture)
  if (isUpcomingStatus(fixture.statusShort)) return formatMatchTimeArgentina(fixture.date)
  if (isPostponedStatus(fixture.statusShort)) return fixture.statusShort

  return formatMatchStatusUnderScore({
    statusShort: fixture.statusShort,
    minute: fixture.minute,
    date: fixture.date,
  })
}

function getMatchSubLabel(fixture: LeagueFixtureSummary) {
  if (isLiveStatus(fixture.statusShort)) {
    return fixture.minute ? `${fixture.minute}'` : 'En vivo'
  }

  if (isFinishedStatus(fixture.statusShort)) return 'Finalizado'

  return getFixtureDayText(fixture)
}

function getVisibleFixtures(fixtures: LeagueFixtureSummary[]) {
  const today = getArgentinaTodayISO()
  const sorted = sortFixturesByDate(fixtures)
  const liveFixtures = sorted.filter((fixture) => isLiveStatus(fixture.statusShort))
  const todayFixtures = sorted.filter(
    (fixture) => fixture.date && getArgentinaDateISO(fixture.date) === today
  )
  const upcomingFixtures = sorted.filter((fixture) => {
    if (!fixture.date) return false
    return getFixtureTimestamp(fixture) >= Date.now() && isUpcomingStatus(fixture.statusShort)
  })

  const featured = liveFixtures[0] ?? todayFixtures[0] ?? upcomingFixtures[0] ?? sorted[0] ?? null
  const baseList = todayFixtures.length ? todayFixtures : upcomingFixtures
  const secondary = baseList
    .filter((fixture) => String(fixture.id) !== String(featured?.id))
    .slice(0, TODAY_FIXTURE_LIMIT - 1)

  if (!secondary.length && sorted.length) {
    return {
      featured,
      secondary: sorted
        .filter((fixture) => String(fixture.id) !== String(featured?.id))
        .slice(0, TODAY_FIXTURE_LIMIT - 1),
      showingUpcomingFallback: !todayFixtures.length,
    }
  }

  return {
    featured,
    secondary,
    showingUpcomingFallback: !todayFixtures.length,
  }
}

function getPrimaryStandingGroup(groups: LeagueStandingGroup[]) {
  return groups.find((group) => getWorldCupGroupKey(group.name) && group.rows.length) ?? groups.find((group) => group.rows.length) ?? null
}

function getTopStandingRows(group: LeagueStandingGroup | null) {
  if (!group) return []

  return [...group.rows]
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      if (b.points !== a.points) return b.points - a.points
      return a.teamName.localeCompare(b.teamName, 'es-AR')
    })
    .slice(0, 4)
}

function TeamBadge({
  name,
  logo,
  teamId,
  locale,
  align = 'center',
}: {
  name: string
  logo?: string
  teamId?: number
  locale: AppLocale
  align?: 'left' | 'center' | 'right'
}) {
  const displayName = getTeamName(name, locale)

  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : align === 'left' ? 'text-left' : 'text-center'}`}>
      <div className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'justify-end' : align === 'left' ? 'justify-start' : 'justify-center'}`}>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_6px_14px_rgba(7,27,47,0.12)]">
          <TeamLogo
            src={logo}
            team={{ id: teamId, name, logo }}
            alt={displayName}
            size={32}
            className="h-8 w-8 object-contain"
          />
        </span>
        <span className="min-w-0 truncate text-sm font-black text-current md:text-[15px]">
          {displayName}
        </span>
      </div>
    </div>
  )
}

function WorldCupSidebar() {
  return (
    <aside className="hf-world-sidebar hidden lg:flex">
      <Link href="/" aria-label="Hay Fulbo inicio" className="hf-world-logo-link">
        <Image src={HF_LOGO_SRC} alt="Hay Fulbo" width={134} height={91} priority className="h-auto w-[108px]" />
      </Link>

      <nav aria-label="Navegacion Mundial" className="mt-6 flex min-h-0 flex-1 flex-col gap-1.5">
        {sidebarItems.map((item, index) => (
          <Link
            key={item.label}
            href={item.href}
            className={`hf-world-sidebar-item ${item.active ? 'is-active' : ''} ${index === 4 ? 'mt-4 border-t border-[rgba(7,27,47,0.1)] pt-4' : ''}`}
          >
            <Icon name={item.icon} className="h-5 w-5" />
            <span className="min-w-0 truncate">{item.label}</span>
            {item.badge ? <span className="hf-world-sidebar-badge">{item.badge}</span> : null}
          </Link>
        ))}
      </nav>

      <Link href="/prode" className="hf-world-prode-card">
        <span className="block text-xl font-black leading-tight">PRODE<br />MUNDIAL</span>
        <span className="mt-2 block text-xs font-semibold text-white/75">Juga y gana premios increibles</span>
        <span className="mt-4 inline-flex rounded-lg bg-[var(--hf-world-green)] px-4 py-2 text-xs font-black text-[var(--hf-world-navy)]">
          JUGAR AHORA
        </span>
      </Link>
    </aside>
  )
}

function DateSwitch() {
  return (
    <div className="hf-world-date-switch" aria-label="Selector de fecha">
      {['Ayer', 'Hoy', 'Manana'].map((label) => (
        <button
          key={label}
          type="button"
          className={label === 'Hoy' ? 'is-active' : ''}
          aria-pressed={label === 'Hoy'}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function WorldCupHeader() {
  return (
    <header className="hf-world-header">
      <button type="button" className="hf-world-icon-button lg:hidden" aria-label="Abrir menu">
        <Icon name="menu" />
      </button>

      <Link href="/" className="hidden items-center gap-4 lg:flex" aria-label="Hay Fulbo inicio">
        <Image src={HF_LOGO_SRC} alt="Hay Fulbo" width={134} height={91} priority className="h-auto w-[64px]" />
        <span className="text-2xl font-black tracking-[0] text-[var(--hf-world-navy)]">HAY FULBO</span>
      </Link>

      <Link href="/" className="lg:hidden" aria-label="Hay Fulbo inicio">
        <Image src={HF_LOGO_SRC} alt="Hay Fulbo" width={134} height={91} priority className="h-auto w-[88px]" />
      </Link>

      <div className="hidden flex-1 justify-center lg:flex">
        <DateSwitch />
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className="hf-world-icon-button" aria-label="Buscar">
          <Icon name="search" />
        </button>
        <button type="button" className="hf-world-icon-button hidden lg:inline-flex" aria-label="Mi cuenta">
          <Icon name="user" />
        </button>
      </div>

      <div className="col-span-3 flex justify-center lg:hidden">
        <DateSwitch />
      </div>
    </header>
  )
}

function WorldCupHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section id="mundial" className="hf-world-hero">
      <div className="relative z-10 max-w-[58%] sm:max-w-[55%] lg:max-w-xl">
        <p className="text-sm font-black uppercase text-[var(--hf-world-green)] sm:text-2xl lg:text-5xl">
          Copa
        </p>
        <h1 className="mt-1 text-[2rem] font-black uppercase leading-[0.9] text-white sm:text-5xl lg:text-7xl">
          Del Mundo
          <span className="block text-[var(--hf-world-green)]">2026</span>
        </h1>
        <div className="mt-4 flex flex-col gap-2 text-xs font-bold text-white sm:flex-row sm:text-sm">
          <span className="hf-world-hero-pill">
            <Icon name="pin" className="h-4 w-4" />
            {subtitle}
          </span>
          <span className="hf-world-hero-pill hidden sm:inline-flex">
            <Icon name="calendar" className="h-4 w-4" />
            11 jun - 19 jul 2026
          </span>
        </div>
      </div>

      <div className="hf-world-hero-mark" aria-hidden="true">
        <span>20</span>
        <span>26</span>
      </div>
      <div className="hf-world-hero-brush" aria-hidden="true" />
      <div className="hf-world-hero-emblem" aria-hidden="true">
        <Image
          src={WORLD_CUP_TROPHY_SRC}
          alt=""
          width={207}
          height={505}
          priority
          className="hf-world-hero-trophy"
        />
      </div>
      <span className="sr-only">{title}</span>
    </section>
  )
}

function WorldCupTabs() {
  return (
    <nav className="hf-world-tabs" aria-label="Secciones del Mundial">
      {tabs.map((tab, index) => (
        <a key={tab} href={index === 0 ? '#partidos' : index === 1 ? '#posiciones' : index === 2 ? '#goleadores' : '#mundial-grupos'} className={index === 0 ? 'is-active' : ''}>
          {tab}
        </a>
      ))}
    </nav>
  )
}

function WorldCupGroupFilter() {
  return (
    <div className="hf-world-chip-row" aria-label="Filtro de grupos">
      <a href="#partidos" className="is-active">Todos</a>
      {WORLD_CUP_GROUP_KEYS.map((groupKey) => (
        <a key={groupKey} href="#mundial-grupos">
          Grupo {groupKey}
        </a>
      ))}
    </div>
  )
}

function SectionTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div className="hf-world-section-title">
      <h2>{title}</h2>
      {href ? (
        <a href={href}>
          Ver todos
          <span aria-hidden="true">&gt;</span>
        </a>
      ) : null}
    </div>
  )
}

function LiveMatchCard({ fixture, locale }: { fixture: LeagueFixtureSummary; locale: AppLocale }) {
  const live = isLiveStatus(fixture.statusShort)
  const badgeLabel = live ? 'EN VIVO' : isFinishedStatus(fixture.statusShort) ? 'FINALIZADO' : 'PROXIMO'

  return (
    <Link href={`/partido/${fixture.id}`} className="hf-world-live-card">
      <span className={`hf-world-status-badge ${live ? 'is-live' : ''}`}>{badgeLabel}</span>
      <div className="text-center text-xs font-black text-white/72">{getFixtureMeta(fixture)}</div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <TeamBadge
          name={fixture.home}
          logo={fixture.homeLogo}
          teamId={fixture.homeId}
          locale={locale}
        />
        <div className="min-w-[96px] text-center">
          <div className="text-5xl font-black leading-none text-white">{hasScore(fixture) ? getFixtureScore(fixture) : 'vs'}</div>
          <div className={`mt-2 text-base font-black ${live ? 'text-[var(--hf-world-coral)]' : 'text-white/72'}`}>
            {getMatchSubLabel(fixture)}
          </div>
        </div>
        <TeamBadge
          name={fixture.away}
          logo={fixture.awayLogo}
          teamId={fixture.awayId}
          locale={locale}
        />
      </div>

      <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/35 px-5 py-2 text-xs font-black text-white">
        <Icon name="play" className="h-4 w-4" />
        {live ? 'VER EN VIVO' : 'VER PARTIDO'}
      </span>
    </Link>
  )
}

function MatchRow({ fixture, locale }: { fixture: LeagueFixtureSummary; locale: AppLocale }) {
  return (
    <div className="hf-world-match-row">
      <Link href={`/partido/${fixture.id}`} className="contents">
        <div className="min-w-0">
          <p className="text-xs font-black text-[var(--hf-world-muted)]">{getFixtureMeta(fixture)}</p>
          <TeamBadge
            name={fixture.home}
            logo={fixture.homeLogo}
            teamId={fixture.homeId}
            locale={locale}
            align="left"
          />
        </div>

        <div className="text-center">
          <div className="text-2xl font-black leading-none text-[var(--hf-world-navy)]">{getMatchCenterLabel(fixture)}</div>
          <div className="mt-1 text-xs font-bold text-[var(--hf-world-muted)]">{getMatchSubLabel(fixture)}</div>
        </div>

        <div className="min-w-0">
          <TeamBadge
            name={fixture.away}
            logo={fixture.awayLogo}
            teamId={fixture.awayId}
            locale={locale}
            align="right"
          />
        </div>
      </Link>

      <button type="button" className="hf-world-row-action" aria-label="Crear recordatorio">
        <Icon name="bell" className="h-4 w-4" />
      </button>
    </div>
  )
}

function MatchesPanel({
  fixtures,
  locale,
}: {
  fixtures: LeagueFixtureSummary[]
  locale: AppLocale
}) {
  const { featured, secondary, showingUpcomingFallback } = getVisibleFixtures(fixtures)

  return (
    <section id="partidos" className="min-w-0">
      <SectionTitle title="PARTIDOS DE HOY" href="#mundial-grupos" />
      {showingUpcomingFallback && fixtures.length ? (
        <p className="-mt-2 mb-3 text-xs font-bold text-[var(--hf-world-muted)]">
          No hay partidos para hoy. Mostrando los proximos disponibles.
        </p>
      ) : null}

      {featured ? (
        isLiveStatus(featured.statusShort) ? (
          <LiveMatchCard fixture={featured} locale={locale} />
        ) : (
          <MatchRow fixture={featured} locale={locale} />
        )
      ) : (
        <div className="hf-world-empty-card">
          Todavia no hay partidos sincronizados para esta fecha.
        </div>
      )}

      {secondary.length ? (
        <div className="mt-3 space-y-3">
          {secondary.map((fixture) => (
            <MatchRow key={fixture.id} fixture={fixture} locale={locale} />
          ))}
        </div>
      ) : null}

      <a href="#mundial-grupos" className="hf-world-all-matches">
        VER TODOS LOS PARTIDOS
        <span aria-hidden="true">&gt;</span>
      </a>
    </section>
  )
}

function StandingsCard({
  group,
  locale,
}: {
  group: LeagueStandingGroup | null
  locale: AppLocale
}) {
  const rows = getTopStandingRows(group)

  return (
    <section id="posiciones" className="hf-world-side-card">
      <div className="hf-world-side-card-head">
        <h2>POSICIONES</h2>
        <a href="#mundial-grupos">Ver todas</a>
      </div>
      <p className="mb-3 text-sm font-black text-[var(--hf-world-navy)]">
        {group ? group.name.replace(/^Group/i, 'Grupo') : 'Grupo'}
      </p>

      {rows.length ? (
        <div className="overflow-hidden rounded-xl border border-[var(--hf-world-border)]">
          <table className="hf-world-standings-table">
            <thead>
              <tr>
                <th aria-label="Posicion" />
                <th>Equipo</th>
                <th>PJ</th>
                <th>DG</th>
                <th>PTS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.teamId ?? row.teamName}-${row.rank}`} className={index === 0 ? 'is-leading' : ''}>
                  <td>{row.rank}</td>
                  <td>
                    <span className="flex min-w-0 items-center gap-2">
                      <TeamLogo
                        src={row.teamLogo}
                        team={{ id: row.teamId, name: row.teamName, logo: row.teamLogo }}
                        alt={getTeamName(row.teamName, locale)}
                        size={20}
                        className="h-5 w-5 object-contain"
                      />
                      <span className="min-w-0 truncate">{getTeamName(row.teamName, locale)}</span>
                    </span>
                  </td>
                  <td>{row.played}</td>
                  <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                  <td>{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="hf-world-empty-card is-compact">
          La tabla se va a mostrar cuando haya posiciones sincronizadas.
        </div>
      )}
    </section>
  )
}

function ScorersCard({ scorers }: { scorers: TopPlayerRow[] }) {
  const rows = scorers.slice(0, 3)

  return (
    <section id="goleadores" className="hf-world-side-card">
      <div className="hf-world-side-card-head">
        <h2>GOLEADORES</h2>
        <a href="#estadisticas">Ver todos</a>
      </div>

      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={`${row.playerId ?? row.name}-${index}`} className="grid grid-cols-[20px_38px_minmax(0,1fr)_auto] items-center gap-3">
              <span className="text-sm font-black text-[var(--hf-world-navy)]">{index + 1}</span>
              <PlayerPhoto
                src={row.photo}
                player={{ id: row.playerId, name: row.name, photo: row.photo }}
                alt={row.name}
                size={38}
                className="h-full w-full rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[var(--hf-world-navy)]">{row.name}</p>
                <p className="truncate text-xs font-semibold text-[var(--hf-world-muted)]">{row.teamName ?? 'Seleccion'}</p>
              </div>
              <span className="text-base font-black text-[var(--hf-world-navy)]">{row.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="hf-world-empty-card is-compact">
          Los goleadores se van a mostrar cuando haya estadisticas.
        </div>
      )}
    </section>
  )
}

function NewsCard() {
  return (
    <section id="noticias" className="hf-world-side-card">
      <div className="hf-world-side-card-head">
        <h2>NOTICIAS DESTACADAS</h2>
        <Link href="/noticias">Ver todas</Link>
      </div>
      <div className="hf-world-empty-card is-compact">
        Las noticias destacadas del Mundial se mostraran cuando haya una fuente editorial disponible.
      </div>
    </section>
  )
}

function QuickAccessMobile() {
  return (
    <nav className="hf-world-mobile-quick lg:hidden" aria-label="Accesos rapidos">
      {mobileQuickItems.map((item) => (
        <a key={item.label} href={item.href} className={item.active ? 'is-active' : ''}>
          <Icon name={item.icon} className="h-6 w-6" />
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  )
}

function MobileBottomNav() {
  return (
    <nav className="hf-world-bottom-nav lg:hidden" aria-label="Navegacion principal Mundial">
      {mobileBottomItems.map((item) => (
        <Link key={item.label} href={item.href} className={item.active ? 'is-active' : ''}>
          <Icon name={item.icon} className="h-5 w-5" />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

function FullSections({
  groupStageSection,
  bracketSection,
  leaderStatsSection,
}: {
  groupStageSection?: ReactNode
  bracketSection?: ReactNode
  leaderStatsSection?: ReactNode
}) {
  if (!groupStageSection && !bracketSection && !leaderStatsSection) return null

  return (
    <div className="mt-5 space-y-5">
      {groupStageSection ? (
        <section id="mundial-grupos" className="min-w-0">
          <SectionTitle title="FASE DE GRUPOS COMPLETA" />
          <div className="hf-world-legacy-section">{groupStageSection}</div>
        </section>
      ) : null}

      {bracketSection ? (
        <section id="llaves" className="min-w-0">
          <SectionTitle title="LLAVES Y SIMULADOR" />
          <div className="hf-world-legacy-section">{bracketSection}</div>
        </section>
      ) : null}

      {leaderStatsSection ? (
        <section id="estadisticas" className="min-w-0">
          <SectionTitle title="ESTADISTICAS COMPLETAS" />
          <div className="hf-world-legacy-section">{leaderStatsSection}</div>
        </section>
      ) : null}
    </div>
  )
}

export default function WorldCupRedesign({
  title,
  subtitle,
  fixtures,
  standings,
  scorers,
  locale,
  errorMessage,
  hasTournamentData,
  bracketSection,
  groupStageSection,
  leaderStatsSection,
}: WorldCupRedesignProps) {
  const primaryGroup = getPrimaryStandingGroup(standings)

  return (
    <div className="hf-world-shell">
      <WorldCupSidebar />

      <div className="hf-world-main">
        <WorldCupHeader />
        <WorldCupHero title={title} subtitle={subtitle} />
        <div className="hf-world-mobile-dots lg:hidden" aria-hidden="true">
          <span className="is-active" />
          <span />
          <span />
          <span />
        </div>
        <QuickAccessMobile />
        <WorldCupTabs />
        <WorldCupGroupFilter />

        {errorMessage ? (
          <div className="hf-world-alert">{errorMessage}</div>
        ) : null}

        {!errorMessage && !hasTournamentData ? (
          <div className="hf-world-empty-card">
            Todavia no hay datos sincronizados para el Mundial. La vista queda preparada para mostrarlos apenas esten disponibles.
          </div>
        ) : null}

        <div className="hf-world-content-grid">
          <div className="min-w-0">
            <MatchesPanel fixtures={fixtures} locale={locale} />
          </div>

          <aside className="hf-world-side-column">
            <StandingsCard group={primaryGroup} locale={locale} />
            <ScorersCard scorers={scorers} />
            <NewsCard />
          </aside>
        </div>

        <FullSections
          groupStageSection={groupStageSection}
          bracketSection={bracketSection}
          leaderStatsSection={leaderStatsSection}
        />
      </div>

      <MobileBottomNav />
    </div>
  )
}
