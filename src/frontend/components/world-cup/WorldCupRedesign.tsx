import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import CompetitionSectionNav from '@/frontend/components/competition/CompetitionSectionNav'
import MatchReminderButton from '@/frontend/components/matches/MatchReminderButton'
import { TeamLogo } from '@/frontend/components/AssetImage'
import type {
  LeagueFixtureSummary,
  LeagueStandingGroup,
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
  hasPenaltyShootoutScore,
} from '@/shared/utils/match-display'
import {
  isFinishedStatus,
  isLiveStatus,
  isPostponedStatus,
  isUpcomingStatus,
} from '@/shared/utils/match-status'
import { getWorldCupGroupKey, WORLD_CUP_GROUP_KEYS } from '@/shared/utils/world-cup-groups'
import type { AppLocale } from '@/shared/i18n/locales'
import WorldCupImageCarousel from './WorldCupImageCarousel'
import WorldCupTabbedSections from './WorldCupTabbedSections'

type WorldCupRedesignProps = {
  title: string
  subtitle: string
  fixtures: LeagueFixtureSummary[]
  standings: LeagueStandingGroup[]
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

const WORLD_CUP_TROPHY_SRC = '/brand/competitions/world-cup-trophy-transparent.png'
const TODAY_FIXTURE_LIMIT = 4

const mobileQuickItems: Array<{ label: string; href: string; icon: IconName; active?: boolean }> = [
  { label: 'Llaves', href: '#fase-eliminatoria', icon: 'bracket', active: true },
  { label: 'Clasificacion', href: '#fase-de-grupos', icon: 'calendar' },
  { label: 'Estadisticas', href: '#estadisticas', icon: 'chart' },
  { label: 'Selecciones', href: '#selecciones', icon: 'shield' },
  { label: 'Mas', href: '#sedes', icon: 'more' },
]

const worldCupTabs: Array<{ label: string; href: string; active?: boolean }> = [
  { label: 'Llaves', href: '#fase-eliminatoria', active: true },
  { label: 'Clasificacion', href: '#fase-de-grupos' },
  { label: 'Estadisticas', href: '#estadisticas' },
  { label: 'Selecciones', href: '#selecciones' },
]

const worldCupMoreTabs: Array<{ label: string; href: string; active?: boolean }> = [
  { label: 'Sedes', href: '#sedes' },
  { label: 'Historia', href: '#historia' },
]

const worldCupVenues: Array<{
  country: string
  venues: Array<{ name: string; city: string }>
}> = [
  {
    country: 'Mexico',
    venues: [
      { name: 'Estadio Azteca', city: 'Ciudad de Mexico' },
      { name: 'Estadio Guadalajara', city: 'Zapopan' },
      { name: 'Estadio Monterrey', city: 'Guadalupe' },
    ],
  },
  {
    country: 'Canada',
    venues: [
      { name: 'BC Place', city: 'Vancouver' },
      { name: 'Toronto Stadium', city: 'Toronto' },
    ],
  },
  {
    country: 'Estados Unidos',
    venues: [
      { name: 'MetLife Stadium', city: 'New York / New Jersey' },
      { name: 'AT&T Stadium', city: 'Dallas' },
      { name: 'SoFi Stadium', city: 'Los Angeles' },
      { name: 'Hard Rock Stadium', city: 'Miami' },
      { name: 'Gillette Stadium', city: 'Boston' },
      { name: 'NRG Stadium', city: 'Houston' },
      { name: 'Lincoln Financial Field', city: 'Philadelphia' },
      { name: 'Lumen Field', city: 'Seattle' },
      { name: "Levi's Stadium", city: 'San Francisco Bay Area' },
      { name: 'Mercedes-Benz Stadium', city: 'Atlanta' },
      { name: 'Arrowhead Stadium', city: 'Kansas City' },
    ],
  },
]

const worldCupHistory: Array<{
  year: string
  host: string
  champion: string
  flag: string
  result: string
  venue: string
}> = [
  { year: '1930', host: 'Uruguay', champion: 'Uruguay', flag: '🇺🇾', result: 'Uruguay 4-2 Argentina', venue: 'Estadio Centenario, Montevideo' },
  { year: '1934', host: 'Italia', champion: 'Italia', flag: '🇮🇹', result: 'Italia 2-1 Checoslovaquia', venue: 'Stadio Nazionale PNF, Roma' },
  { year: '1938', host: 'Francia', champion: 'Italia', flag: '🇮🇹', result: 'Italia 4-2 Hungria', venue: 'Stade Olympique, Colombes' },
  { year: '1950', host: 'Brasil', champion: 'Uruguay', flag: '🇺🇾', result: 'Uruguay 2-1 Brasil', venue: 'Maracana, Rio de Janeiro' },
  { year: '1954', host: 'Suiza', champion: 'Alemania Federal', flag: '🇩🇪', result: 'Alemania Federal 3-2 Hungria', venue: 'Wankdorfstadion, Berna' },
  { year: '1958', host: 'Suecia', champion: 'Brasil', flag: '🇧🇷', result: 'Brasil 5-2 Suecia', venue: 'Rasunda, Solna' },
  { year: '1962', host: 'Chile', champion: 'Brasil', flag: '🇧🇷', result: 'Brasil 3-1 Checoslovaquia', venue: 'Estadio Nacional, Santiago' },
  { year: '1966', host: 'Inglaterra', champion: 'Inglaterra', flag: '🇬🇧', result: 'Inglaterra 4-2 Alemania Federal', venue: 'Wembley, Londres' },
  { year: '1970', host: 'Mexico', champion: 'Brasil', flag: '🇧🇷', result: 'Brasil 4-1 Italia', venue: 'Estadio Azteca, Ciudad de Mexico' },
  { year: '1974', host: 'Alemania Federal', champion: 'Alemania Federal', flag: '🇩🇪', result: 'Alemania Federal 2-1 Paises Bajos', venue: 'Olympiastadion, Munich' },
  { year: '1978', host: 'Argentina', champion: 'Argentina', flag: '🇦🇷', result: 'Argentina 3-1 Paises Bajos', venue: 'Monumental, Buenos Aires' },
  { year: '1982', host: 'Espana', champion: 'Italia', flag: '🇮🇹', result: 'Italia 3-1 Alemania Federal', venue: 'Santiago Bernabeu, Madrid' },
  { year: '1986', host: 'Mexico', champion: 'Argentina', flag: '🇦🇷', result: 'Argentina 3-2 Alemania Federal', venue: 'Estadio Azteca, Ciudad de Mexico' },
  { year: '1990', host: 'Italia', champion: 'Alemania Federal', flag: '🇩🇪', result: 'Alemania Federal 1-0 Argentina', venue: 'Olimpico, Roma' },
  { year: '1994', host: 'Estados Unidos', champion: 'Brasil', flag: '🇧🇷', result: 'Brasil 0-0 Italia (3-2 pen.)', venue: 'Rose Bowl, Pasadena' },
  { year: '1998', host: 'Francia', champion: 'Francia', flag: '🇫🇷', result: 'Francia 3-0 Brasil', venue: 'Stade de France, Saint-Denis' },
  { year: '2002', host: 'Corea del Sur / Japon', champion: 'Brasil', flag: '🇧🇷', result: 'Brasil 2-0 Alemania', venue: 'Yokohama International Stadium' },
  { year: '2006', host: 'Alemania', champion: 'Italia', flag: '🇮🇹', result: 'Italia 1-1 Francia (5-3 pen.)', venue: 'Olympiastadion, Berlin' },
  { year: '2010', host: 'Sudafrica', champion: 'Espana', flag: '🇪🇸', result: 'Espana 1-0 Paises Bajos', venue: 'Soccer City, Johannesburgo' },
  { year: '2014', host: 'Brasil', champion: 'Alemania', flag: '🇩🇪', result: 'Alemania 1-0 Argentina', venue: 'Maracana, Rio de Janeiro' },
  { year: '2018', host: 'Rusia', champion: 'Francia', flag: '🇫🇷', result: 'Francia 4-2 Croacia', venue: 'Luzhniki, Moscu' },
  { year: '2022', host: 'Qatar', champion: 'Argentina', flag: '🇦🇷', result: 'Argentina 3-3 Francia (4-2 pen.)', venue: 'Lusail Stadium' },
]

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

function MatchScoreLabel({
  fixture,
  fallback,
  variant,
}: {
  fixture: LeagueFixtureSummary
  fallback: string
  variant: 'live' | 'row'
}) {
  if (!hasScore(fixture)) {
    return <span className={`hf-world-score-label hf-world-score-label--${variant}`}>{fallback}</span>
  }

  if (!hasPenaltyShootoutScore(fixture.homePenaltyScore, fixture.awayPenaltyScore)) {
    return (
      <span className={`hf-world-score-label hf-world-score-label--${variant}`}>
        {getFixtureScore(fixture)}
      </span>
    )
  }

  return (
    <span
      className={`hf-world-score-label hf-world-score-label--${variant} is-penalties`}
      aria-label={`Resultado ${fixture.goalsHome} a ${fixture.goalsAway}, penales ${fixture.homePenaltyScore} a ${fixture.awayPenaltyScore}`}
    >
      <span className="hf-world-score-penalty">({fixture.homePenaltyScore})</span>
      <span className="hf-world-score-main">
        {fixture.goalsHome} - {fixture.goalsAway}
      </span>
      <span className="hf-world-score-penalty">({fixture.awayPenaltyScore})</span>
    </span>
  )
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

function getLiveMatchCenterSubLabel(fixture: LeagueFixtureSummary) {
  const label = getMatchSubLabel(fixture)

  return label.toLowerCase() === 'en vivo' ? '' : label
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

function getGroupDisplayName(name: string) {
  const groupKey = getWorldCupGroupKey(name)

  return groupKey ? `Grupo ${groupKey}` : name.replace(/^Group/i, 'Grupo')
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
          width={300}
          height={503}
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
    <CompetitionSectionNav
      label="Secciones del Mundial"
      items={worldCupTabs.map((tab) => ({
        key: tab.href,
        label: tab.label,
        href: tab.href,
        active: tab.active,
      }))}
      moreItems={worldCupMoreTabs.map((tab) => ({
        key: tab.href,
        label: tab.label,
        href: tab.href,
      }))}
      className="hf-world-tabs"
    />
  )
}

function WorldCupGroupFilter() {
  return (
    <nav className="hf-world-group-jump-row" aria-label="Grupos del Mundial">
      {WORLD_CUP_GROUP_KEYS.map((groupKey) => (
        <a key={groupKey} href={`#group-${groupKey}`}>
          Grupo {groupKey}
        </a>
      ))}
    </nav>
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
  const centerSubLabel = live ? getLiveMatchCenterSubLabel(fixture) : getMatchSubLabel(fixture)

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
          <div className="text-5xl font-black leading-none text-white">
            <MatchScoreLabel fixture={fixture} fallback="vs" variant="live" />
          </div>
          {centerSubLabel ? (
            <div className={`mt-2 text-base font-black ${live ? 'text-[var(--hf-world-coral)]' : 'text-white/72'}`}>
              {centerSubLabel}
            </div>
          ) : null}
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
  const reminder = {
    matchId: String(fixture.id),
    href: `/partido/${fixture.id}`,
    home: getTeamName(fixture.home, locale),
    away: getTeamName(fixture.away, locale),
    homeLogo: fixture.homeLogo ?? null,
    awayLogo: fixture.awayLogo ?? null,
    date: fixture.date,
    displayTime: getMatchCenterLabel(fixture),
    status: getMatchSubLabel(fixture),
  }

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
          <div className="text-2xl font-black leading-none text-[var(--hf-world-navy)]">
            <MatchScoreLabel
              fixture={fixture}
              fallback={getMatchCenterLabel(fixture)}
              variant="row"
            />
          </div>
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

      <MatchReminderButton reminder={reminder} compact />
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
      <SectionTitle title="PARTIDOS DE HOY" href="#fase-eliminatoria" />
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

      <a href="#fase-eliminatoria" className="hf-world-all-matches">
        VER TODOS LOS PARTIDOS
        <span aria-hidden="true">&gt;</span>
      </a>
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
    <CompetitionSectionNav
      label="Accesos rapidos del Mundial"
      variant="quick"
      className="hf-world-mobile-quick lg:hidden"
      items={mobileQuickItems.map((item) => ({
        key: item.label,
        label: item.label,
        href: item.href,
        active: item.active,
        icon: <Icon name={item.icon} className="h-6 w-6" />,
      }))}
    />
  )
}

function SelectionsSection({
  standings,
  locale,
}: {
  standings: LeagueStandingGroup[]
  locale: AppLocale
}) {
  const groups = standings
    .filter((group) => getWorldCupGroupKey(group.name) && group.rows.length)
    .sort((a, b) => {
      const aKey = getWorldCupGroupKey(a.name) ?? ''
      const bKey = getWorldCupGroupKey(b.name) ?? ''

      return (
        WORLD_CUP_GROUP_KEYS.indexOf(aKey as (typeof WORLD_CUP_GROUP_KEYS)[number]) -
        WORLD_CUP_GROUP_KEYS.indexOf(bKey as (typeof WORLD_CUP_GROUP_KEYS)[number])
      )
    })

  return (
    <div className="min-w-0">
      <SectionTitle title="SELECCIONES" />
      {groups.length ? (
        <div className="hf-world-selection-groups">
          {groups.map((group) => (
            <div key={group.name} className="hf-world-selection-group">
              <h3>{getGroupDisplayName(group.name)}</h3>
              <div className="hf-world-selection-row">
                {group.rows.map((row) => {
                  const cardContent = (
                    <>
                      <TeamLogo
                        src={row.teamLogo}
                        team={{ id: row.teamId, name: row.teamName, logo: row.teamLogo }}
                        alt={getTeamName(row.teamName, locale)}
                        size={42}
                        className="h-11 w-11 object-contain"
                      />
                      <span>{getTeamName(row.teamName, locale)}</span>
                    </>
                  )

                  return row.teamId ? (
                    <Link
                      key={row.teamId}
                      href={`/equipo/${row.teamId}`}
                      className="hf-world-selection-card"
                    >
                      {cardContent}
                    </Link>
                  ) : (
                    <div key={row.teamName} className="hf-world-selection-card" aria-disabled="true">
                      {cardContent}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="hf-world-empty-card">
          Las selecciones se van a mostrar agrupadas cuando haya posiciones sincronizadas.
        </div>
      )}
    </div>
  )
}

function VenuesSection() {
  return (
    <div className="min-w-0">
      <SectionTitle title="SEDES" />
      <div className="hf-world-venue-grid">
        {worldCupVenues.map((host) => (
          <article key={host.country} className="hf-world-info-card">
            <h3>{host.country}</h3>
            <div className="hf-world-venue-list">
              {host.venues.map((venue) => (
                <div key={`${host.country}-${venue.name}`} className="hf-world-venue-item">
                  <strong>{venue.name}</strong>
                  <span>{venue.city}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function HistorySection() {
  return (
    <div className="min-w-0">
      <SectionTitle title="HISTORIA" />
      <article className="hf-world-history-intro">
        <h3>La copa que ordena el mapa del futbol</h3>
        <p>
          El Mundial nacio en 1930 y se transformo en la competencia mas influyente
          del futbol de selecciones: identidad, generaciones, estadios historicos y
          campeones que marcaron epocas. La edicion 2026 abre una etapa nueva con
          48 equipos y tres paises anfitriones.
        </p>
      </article>
      <div className="hf-world-history-grid">
        {worldCupHistory.map((item) => (
          <details key={item.year} className="hf-world-history-card">
            <summary>
              <span className="hf-world-history-flag" aria-label={`Bandera de ${item.champion}`}>
                {item.flag}
              </span>
              <strong>{item.year}</strong>
              <span>{item.host}</span>
              <b>{item.champion}</b>
            </summary>
            <div className="hf-world-history-detail">
              <p><span>Final</span>{item.result}</p>
              <p><span>Sede</span>{item.venue}</p>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}

function FullSections({
  fixtures,
  groupStageSection,
  bracketSection,
  leaderStatsSection,
  standings,
  locale,
}: {
  fixtures: LeagueFixtureSummary[]
  groupStageSection?: ReactNode
  bracketSection?: ReactNode
  leaderStatsSection?: ReactNode
  standings: LeagueStandingGroup[]
  locale: AppLocale
}) {
  const defaultPanel = bracketSection
    ? 'fase-eliminatoria'
    : groupStageSection
      ? 'fase-de-grupos'
      : leaderStatsSection
        ? 'estadisticas'
        : 'selecciones'

  return (
    <WorldCupTabbedSections
      defaultPanel={defaultPanel}
      bracketContent={
        bracketSection ? (
          <>
            <div className="hf-world-content-grid">
              <div className="min-w-0">
                <MatchesPanel fixtures={fixtures} locale={locale} />
              </div>

              <aside className="hf-world-side-column">
                <NewsCard />
              </aside>
            </div>
            <SectionTitle title="FASE ELIMINATORIA" />
            <div className="hf-world-legacy-section">{bracketSection}</div>
          </>
        ) : undefined
      }
      groupStageContent={
        groupStageSection ? (
          <>
          <SectionTitle title="FASE DE GRUPOS" />
          <WorldCupGroupFilter />
          <div className="hf-world-legacy-section is-group-stage">{groupStageSection}</div>
          </>
        ) : undefined
      }
      statsContent={
        leaderStatsSection ? (
          <>
          <SectionTitle title="ESTADISTICAS" />
          <div className="hf-world-legacy-section">{leaderStatsSection}</div>
          </>
        ) : undefined
      }
      selectionsContent={<SelectionsSection standings={standings} locale={locale} />}
      venuesContent={<VenuesSection />}
      historyContent={<HistorySection />}
    />
  )
}

export default function WorldCupRedesign({
  title,
  subtitle,
  fixtures,
  standings,
  locale,
  errorMessage,
  hasTournamentData,
  bracketSection,
  groupStageSection,
  leaderStatsSection,
}: WorldCupRedesignProps) {
  return (
    <div className="hf-world-shell hf-world-shell-embedded">
      <div className="hf-world-main">
        <WorldCupHero title={title} subtitle={subtitle} />
        <WorldCupImageCarousel />
        <div className="hf-world-mobile-dots lg:hidden" aria-hidden="true">
          <span className="is-active" />
          <span />
          <span />
          <span />
        </div>
        <QuickAccessMobile />
        <WorldCupTabs />

        {errorMessage ? (
          <div className="hf-world-alert">{errorMessage}</div>
        ) : null}

        {!errorMessage && !hasTournamentData ? (
          <div className="hf-world-empty-card">
            Todavia no hay datos sincronizados para el Mundial. La vista queda preparada para mostrarlos apenas esten disponibles.
          </div>
        ) : null}

        <FullSections
          fixtures={fixtures}
          groupStageSection={groupStageSection}
          bracketSection={bracketSection}
          leaderStatsSection={leaderStatsSection}
          standings={standings}
          locale={locale}
        />
      </div>
    </div>
  )
}
