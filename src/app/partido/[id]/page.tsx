import {
  type MatchBroadcaster,
  type MatchEvent,
  type MatchFixture,
  type MatchLineup,
  type MatchTeamKitColors,
  type PlayerWrapper,
} from '@/lib/api-football'
import AutoRefresh from '@/frontend/components/AutoRefresh'
import LiveMatchClockLabel from '@/frontend/components/LiveMatchClockLabel'
import { TeamLogo as AssetTeamLogo } from '@/frontend/components/AssetImage'
import LineupTabs from '@/frontend/components/LineupTabs'
import SafeImage from '@/frontend/components/SafeImage'
import {
  ARGENTINA_TIME_ZONE,
  formatMatchDateTimeArgentina,
  formatMatchTimeArgentina,
  toArgentinaDate,
} from '@/shared/utils/argentina-time'
import { formatEventMinute } from '@/shared/utils/event-minute'
import {
  getPlayerIncidentsForLineup,
  isInjuryEvent,
  isMissedPenaltyEvent,
  getSubstitutionMap,
  normalizeFootballPersonRef,
  normalizeFootballEventText,
  normalizeMatchEvent,
  normalizeSubstitutionEvent,
  translateMatchEventDetail,
} from '@/shared/utils/football-events'
import { formatMatchScoreWithPenalties } from '@/shared/utils/match-display'
import { getEventElapsedMinute, getFixtureStatusElapsedMinute } from '@/shared/utils/match-minute'
import { isFinishedStatus } from '@/shared/utils/match-status'
import { getRequestLocale } from '@/server/request-locale'
import { t, type AppLocale } from '@/shared/i18n/locales'
import { translateCountryName } from '@/shared/utils/country-names'
import { buildMatchDetailViewModel } from '@/server/match-detail-view-model'
import { getFootballPublicReadMode } from '@/server/football-public-read-mode'
import { runWithFootballApiReadAudit } from '@/server/football-public-read-guard'
import type { HeadToHeadViewModel } from '@/server/head-to-head'
import type { MatchSummarySource } from '@/shared/utils/match-summary'
import { buildSeoMetadata } from '@/shared/seo'
import ShareCardButton from '@/frontend/components/share/ShareCardButton'
import MatchSummaryPlayer from '@/frontend/components/MatchSummaryPlayer'
import Link from 'next/link'
import type { Metadata } from 'next'
import { cache } from 'react'

type PageProps = {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const loadMatchDetailPageData = cache(async (id: string) =>
  runWithFootballApiReadAudit(
    {
      route: 'match-detail',
      cacheOnly: getFootballPublicReadMode('match-detail') === 'cache-only',
    },
    async () =>
      buildMatchDetailViewModel({
        fixtureExternalId: id,
        matchId: id,
      })
  ).then((audit) => audit.result)
)

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const locale = await getRequestLocale()

  try {
    const data = await loadMatchDetailPageData(id)
    const fixture = data.fixture as MatchFixture | null

    if (!fixture) {
      return buildSeoMetadata({
        title: 'Partido no encontrado | Hay Fulbo',
        description: 'El partido solicitado no está disponible en Hay Fulbo.',
        path: `/partido/${id}`,
        noIndex: true,
      })
    }

    const homeTeam = getTeamDisplayName(fixture.teams.home.name, fixture, locale)
    const awayTeam = getTeamDisplayName(fixture.teams.away.name, fixture, locale)
    const leagueName = translateLeagueName(fixture.league.name)
    const score = formatMatchScoreWithPenalties({
      goalsHome: fixture.goals.home,
      goalsAway: fixture.goals.away,
      homePenaltyScore: fixture.score?.penalty?.home,
      awayPenaltyScore: fixture.score?.penalty?.away,
    })
    const hasScore = fixture.goals.home !== null || fixture.goals.away !== null

    return buildSeoMetadata({
      title: `${homeTeam} vs ${awayTeam} | Resultado, Formaciones y Estadísticas | Hay Fulbo`,
      description: hasScore
        ? `${homeTeam} vs ${awayTeam} por ${leagueName}: resultado ${score}, formaciones, estadísticas, goles y eventos del partido.`
        : `Seguí ${homeTeam} vs ${awayTeam} por ${leagueName}: horario, formaciones, estadísticas y toda la previa del partido.`,
      path: `/partido/${id}`,
    })
  } catch {
    return buildSeoMetadata({
      title: 'Partido no disponible | Hay Fulbo',
      description: 'El detalle del partido está temporalmente no disponible en Hay Fulbo.',
      path: `/partido/${id}`,
      noIndex: true,
    })
  }
}

function translateStatus(statusLong: string) {
  const map: Record<string, string> = {
    'Match Finished': 'Finalizado',
    Finished: 'Finalizado',
    'Not Started': 'No iniciado',
    'Time to be defined': 'Horario a confirmar',
    'First Half': 'Primer tiempo',
    'Second Half': 'Segundo tiempo',
    Halftime: 'Entretiempo',
    'Extra Time': 'Tiempo extra',
    'Penalty In Progress': 'Penales en juego',
    'Match Cancelled': 'Cancelado',
    'Match Postponed': 'Postergado',
    'Match Suspended': 'Suspendido',
    Interrupted: 'Interrumpido',
    'Break Time': 'Pausa',
    Live: 'En vivo',
  }

  return map[statusLong] || statusLong
}

function formatMatchTime(dateString: string) {
  return formatMatchTimeArgentina(dateString)
}

function getIntlLocale(locale: AppLocale) {
  return {
    es: 'es-AR',
    en: 'en-US',
    pt: 'pt-BR',
    fr: 'fr-FR',
  }[locale]
}

function formatHeaderDateTime(dateString: string, locale: AppLocale) {
  const timeLabel = formatMatchTimeArgentina(dateString)

  if (timeLabel === 'A confirmar') return t(locale, 'common.unscheduled')

  const intlLocale = getIntlLocale(locale)

  const dateLabel = new Intl.DateTimeFormat(intlLocale, {
    timeZone: ARGENTINA_TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(toArgentinaDate(dateString))

  return `${dateLabel.charAt(0).toLocaleUpperCase(intlLocale)}${dateLabel.slice(1)} · ${timeLabel}`
}

function isHeaderLiveStatus(statusShort: string) {
  return ['LIVE', '1H', '2H', 'ET', 'BT', 'P', 'HT'].includes(statusShort)
}

function formatHeaderStatusLabel(
  statusShort: string,
  statusLong: string,
  elapsed: number | null | undefined,
  dateString: string
) {
  if (isFinishedStatus(statusShort) || isFinishedStatus(statusLong)) {
    return elapsed ? `FINAL ${elapsed}'` : 'FINAL'
  }
  if (statusShort === 'HT') return 'ET'
  if (elapsed) return `${elapsed}'`
  if (statusShort === 'NS') return formatMatchTime(dateString)
  if (statusShort === 'TBD') return 'A confirmar'

  return translateStatus(statusLong).toUpperCase()
}

function getMaxEventElapsedMinute(events: MatchEvent[]) {
  return events.reduce<number | null>((maxMinute, event) => {
    const eventMinute = getEventElapsedMinute(event.time?.elapsed, event.time?.extra)

    if (eventMinute === null) return maxMinute
    if (maxMinute === null) return eventMinute

    return Math.max(maxMinute, eventMinute)
  }, null)
}

function getMatchDisplayElapsed(status: MatchFixture['fixture']['status'], events: MatchEvent[]) {
  const statusMinute = getFixtureStatusElapsedMinute(status)
  const maxEventMinute = getMaxEventElapsedMinute(events)

  if (isFinishedStatus(status.short) || isFinishedStatus(status.long)) {
    if (statusMinute === null) return maxEventMinute
    if (maxEventMinute === null) return statusMinute

    return Math.max(statusMinute, maxEventMinute)
  }

  if (isHeaderLiveStatus(status.short)) {
    if (statusMinute === null) return maxEventMinute
    if (maxEventMinute === null) return statusMinute

    return Math.max(statusMinute, maxEventMinute)
  }

  return statusMinute
}

function translateLeagueName(name: string) {
  const lower = name.toLowerCase()

  if (lower.includes('international friendlies')) return 'Amistoso'
  if (lower.includes('friendly international')) return 'Amistoso'
  if (lower.includes('friendlies')) return 'Amistoso'
  if (
    (
      lower === 'world cup' ||
      lower === 'mundial' ||
      lower.includes('fifa world cup') ||
      lower.includes('copa del mundo')
    ) &&
    !lower.includes('qualification') &&
    !lower.includes('qualif') &&
    !lower.includes('eliminatoria')
  ) {
    return 'Copa del Mundo 2026'
  }

  const map: Record<string, string> = {
    'World Cup': 'Copa del Mundo 2026',
    'Copa America': 'Copa América',
    'UEFA Euro': 'Eurocopa',
    'UEFA Nations League': 'Liga de Naciones UEFA',
    'World Cup - Qualification Europe': 'Eliminatorias UEFA',
    'UEFA Europa League': 'Europa League',
    'UEFA Europa Conference League': 'Conference League',
  }

  return map[name] || name
}

function isInternationalTeamFixture(fixture: MatchFixture) {
  const leagueCountry = fixture.league.country?.toLowerCase() ?? ''
  const leagueName = fixture.league.name.toLowerCase()

  return (
    leagueCountry === 'world' ||
    leagueCountry === 'international' ||
    leagueName.includes('world cup') ||
    leagueName.includes('friendlies') ||
    leagueName.includes('friendly') ||
    leagueName.includes('nations league') ||
    leagueName.includes('copa america') ||
    leagueName.includes('euro') ||
    leagueName.includes('qualification') ||
    leagueName.includes('qualifiers') ||
    leagueName.includes('eliminatoria')
  )
}

function getTeamDisplayName(name: string, fixture: MatchFixture, locale: AppLocale = 'es') {
  if (!isInternationalTeamFixture(fixture)) return name

  return translateCountryName(name, locale) || name
}

function translateStatType(type: string) {
  const map: Record<string, string> = {
    'Shots on Goal': 'Remates al arco',
    'Shots off Goal': 'Remates afuera',
    'Total Shots': 'Remates totales',
    'Blocked Shots': 'Remates bloqueados',
    'Shots insidebox': 'Remates dentro del área',
    'Shots outsidebox': 'Remates fuera del área',
    Fouls: 'Faltas',
    'Corner Kicks': 'Tiros de esquina',
    Offsides: 'Offsides',
    'Ball Possession': 'Posesión',
    'Yellow Cards': 'Tarjetas amarillas',
    'Red Cards': 'Tarjetas rojas',
    'Goalkeeper Saves': 'Atajadas',
    'Total passes': 'Pases totales',
    'Passes accurate': 'Pases correctos',
    'Passes %': 'Precisión de pase',
    expected_goals: 'Goles esperados',
    'Expected Goals': 'Goles esperados',
    'Expected goals': 'Goles esperados',
    'Expected Goals (xG)': 'Goles esperados',
    xG: 'Goles esperados',
    'Attacks': 'Ataques',
    'Dangerous Attacks': 'Ataques peligrosos',
    Saves: 'Atajadas',
    'Goals Prevented': 'Goles evitados',
  }

  return map[type] || type
}

function parseStatNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return value
  if (!value) return 0

  const cleaned = String(value).replace('%', '').replace(',', '.').trim()
  const parsed = Number(cleaned)

  return Number.isFinite(parsed) ? parsed : 0
}

function formatStatValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function formatReferee(referee: string | null | undefined, locale: AppLocale) {
  if (!referee) return t(locale, 'common.notAvailable')

  const parts = referee
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length < 2) return referee

  const [name, ...nationalityParts] = parts
  return `${name} (${nationalityParts.join(', ')})`
}

function formatVenue(venue: { name?: string; city?: string } | null | undefined, locale: AppLocale) {
  if (!venue?.name && !venue?.city) return t(locale, 'common.notAvailable')
  if (venue.name && venue.city) return `${venue.name} (${venue.city})`
  return venue.name || venue.city || t(locale, 'common.notAvailable')
}

function normalizeTeamRefName(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\bjrs\b/g, 'juniors')
    .replace(/\bjunior\b/g, 'juniors')
    .replace(/\bcordoba\b/g, 'cordoba')
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\b(ca|club|de|del|la|el|fc|ac)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function isSameTeamRef(
  candidate: { id?: number; name?: string } | undefined,
  target: { id?: number; name?: string }
) {
  if (!candidate || !target) return false
  if (candidate.id && target.id && Number(candidate.id) === Number(target.id)) return true

  const candidateName = normalizeTeamRefName(candidate.name)
  const targetName = normalizeTeamRefName(target.name)

  if (!candidateName || !targetName) return false

  return (
    candidateName === targetName ||
    candidateName.includes(targetName) ||
    targetName.includes(candidateName)
  )
}

function isHomeEvent(event: MatchEvent, homeTeam: MatchFixture['teams']['home']) {
  return isSameTeamRef(event.team, homeTeam)
}

function isAwayEvent(event: MatchEvent, awayTeam: MatchFixture['teams']['away']) {
  return isSameTeamRef(event.team, awayTeam)
}

function getEventSortValue(event: MatchEvent) {
  return (event.time?.elapsed ?? 0) * 100 + (event.time?.extra ?? 0)
}

function didPenaltyShootoutEventScore(event: MatchEvent) {
  const text = [
    event.type,
    event.detail,
    event.comments,
  ].join(' ').toLowerCase()

  return !(text.includes('missed') || text.includes('saved') || text.includes('failed'))
}

type EventKind = ReturnType<typeof normalizeMatchEvent>['kind']

function normalizeEventText(value?: string | null) {
  return (value || '').toLowerCase()
}

function getEventKind(event: MatchEvent): EventKind {
  return normalizeMatchEvent(event).kind
}

function translateEventDetail(event: MatchEvent) {
  const detail = event.detail || ''
  const type = event.type || ''
  const comments = event.comments || ''
  const translatedVarDetail = translateMatchEventDetail(type, detail, comments)
  const normalizedDetail = normalizeEventText(detail)
  const normalizedType = normalizeEventText(type)
  const normalizedComments = normalizeEventText(comments)

  if (translatedVarDetail) return translatedVarDetail
  if (normalizedDetail.includes('second yellow')) return 'Segunda amarilla'
  if (normalizedDetail.includes('yellow')) return 'Tarjeta amarilla'
  if (normalizedDetail.includes('red')) return 'Tarjeta roja'
  if (normalizedDetail.includes('normal goal')) return 'Gol'
  if (normalizedDetail.includes('own goal')) return 'Gol en contra'
  if (isMissedPenaltyEvent(event)) {
    return 'Penal errado'
  }
  if (normalizedDetail.includes('penalty')) return 'Penal'
  if (normalizedType.includes('subst')) return 'Cambio'
  if (normalizedType.includes('var') || normalizedComments.includes('var')) {
    return 'Revisión VAR'
  }
  if (isInjuryEvent(event)) return 'Lesión'

  const map: Record<string, string> = {
    Foul: 'Falta',
    Injury: 'Lesión',
    Offside: 'Fuera de juego',
    Handball: 'Mano',
    'Penalty Shootout': 'Penales',
  }

  return map[type] || detail || comments || type || 'Evento'
}

function getEventPrimary(event: MatchEvent) {
  const kind = getEventKind(event)

  if (kind === 'var') return 'VAR'
  if (kind === 'penalty') return 'Penal'
  if (kind === 'substitution') {
    const substitution = normalizeSubstitutionEvent(event)

    return substitution?.playerInName
      ? `Entra: ${substitution.playerInName}`
      : event.assist?.name || event.player?.name || 'Cambio'
  }

  return event.player?.name || event.type || 'Evento'
}

function getEventSecondary(event: MatchEvent) {
  const kind = getEventKind(event)

  if (kind === 'goal' || kind === 'penalty-goal') {
    return event.assist?.name
      ? `Asistencia: ${event.assist.name}`
      : translateEventDetail(event)
  }

  if (kind === 'penalty') {
    return translateEventDetail(event)
  }

  if (kind === 'substitution') {
    const substitution = normalizeSubstitutionEvent(event)

    return substitution?.playerOutName
      ? `Sale: ${substitution.playerOutName}`
      : translateEventDetail(event)
  }

  return translateEventDetail(event)
}

function getEventTypeStyle(event: MatchEvent) {
  const kind = getEventKind(event)

  if (kind === 'goal' || kind === 'own-goal') {
    return {
      kind,
      accent: 'text-[#7ff0b2]',
      badge: 'border-[#25553d] bg-[#163828] text-[#7ff0b2]',
    }
  }

  if (kind === 'penalty-goal') {
    return {
      kind,
      accent: 'text-[#7ff0b2]',
      badge: 'border-[#25553d] bg-[#163828] text-[#7ff0b2]',
    }
  }

  if (kind === 'penalty') {
    return {
      kind,
      accent: 'text-[#f3d36c]',
      badge: 'border-[#574b20] bg-[#3f3616] text-[#f3d36c]',
    }
  }

  if (kind === 'penalty-missed') {
    return {
      kind,
      accent: 'text-[#ffb3b3]',
      badge: 'border-[#5a2a2a] bg-[#3b1919] text-[#ffb3b3]',
    }
  }

  if (kind === 'yellow-card') {
    return {
      kind,
      accent: 'text-[#f3d36c]',
      badge: 'border-[#574b20] bg-[#3f3616] text-[#f3d36c]',
    }
  }

  if (kind === 'red-card' || kind === 'second-yellow') {
    return {
      kind,
      accent: 'text-[#ff8f8f]',
      badge: 'border-[#5a2a2a] bg-[#3b1919] text-[#ff8f8f]',
    }
  }

  if (kind === 'substitution') {
    return {
      kind,
      accent: 'text-sky-300',
      badge: 'border-sky-900/80 bg-sky-950/40 text-sky-300',
    }
  }

  if (kind === 'var') {
    return {
      kind,
      accent: 'text-violet-300',
      badge: 'border-violet-900/80 bg-violet-950/40 text-violet-300',
    }
  }

  if (kind === 'injury') {
    return {
      kind,
      accent: 'text-[#f3d36c]',
      badge: 'border-[#574b20] bg-[#3f3616] text-[#f3d36c]',
    }
  }

  return {
    kind,
    accent: 'text-[#a8b0bc]',
    badge: 'border-[#2a3038] bg-[#1c2128] text-[#a8b0bc]',
  }
}

function EventIcon({
  kind,
  size = 'md',
}: {
  kind: EventKind
  size?: 'md' | 'lg'
}) {
  const ballClass = size === 'lg' ? 'h-[24px] w-[24px]' : 'h-[16px] w-[16px]'
  const ballIcon = (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`${ballClass} overflow-visible`}>
      <circle cx="16" cy="16" r="13.4" fill="#f8fafc" stroke="#0f1317" strokeWidth="1.6" />
      <path d="M7.2 22.3c4.8 3.8 11.1 4.3 16.7.2" fill="none" stroke="#d7dbe0" strokeLinecap="round" strokeWidth="2.2" />
      <path
        d="M6.1 9.2c6.8-3 13.6-1.4 20.2 4.8M25.9 8.3c-2.4 6.9-7.3 11.4-14.6 13.4M25.5 22.9c-6.7 2.7-13.4.9-19.7-5.4M6.4 24.1c2.2-6.8 7-11.2 14.5-13.3"
        fill="none"
        stroke="#0a0a0a"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M9.1 11.2c5-2.2 9.8-1.1 14.6 3.2M23.6 11c-2.1 5-5.7 8.3-11 9.8M23 21.1c-5.1 1.8-9.9.5-14.5-3.7M9 21.5c1.8-4.9 5.4-8.2 10.9-9.8"
        fill="none"
        stroke="#7a7f86"
        strokeLinecap="round"
        strokeWidth="1.05"
      />
    </svg>
  )

  if (kind === 'yellow-card') {
    return <span className="inline-block h-[14px] w-[11px] rounded-[1px] bg-[#f3d36c]" />
  }

  if (kind === 'red-card' || kind === 'second-yellow') {
    return <span className="inline-block h-[14px] w-[11px] rounded-[1px] bg-[#ef4444]" />
  }

  if (kind === 'goal' || kind === 'own-goal') {
    return ballIcon
  }

  if (kind === 'penalty' || kind === 'penalty-goal') {
    return (
      <span className="relative inline-flex h-4 w-5 items-center justify-center text-white">
        <span className="absolute inset-x-0 top-[1px] h-2.5 rounded-t-[2px] border-x border-t border-current" />
        <span className="relative scale-[0.62]">{ballIcon}</span>
      </span>
    )
  }

  if (kind === 'penalty-missed') {
    return (
      <span className="relative inline-flex h-4 w-5 items-center justify-center text-white">
        <span className="absolute inset-x-0 top-[1px] h-2.5 rounded-t-[2px] border-x border-t border-current" />
        <span className="relative scale-[0.62]">{ballIcon}</span>
        <span className="absolute h-[1.5px] w-6 rotate-45 bg-[#ff5f5f]" />
        <span className="absolute h-[1.5px] w-6 -rotate-45 bg-[#ff5f5f]" />
      </span>
    )
  }

  if (kind === 'var') {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="relative inline-block h-3.5 w-5 rounded-[2px] border border-current">
          <span className="absolute left-1/2 top-full h-1 w-[1px] -translate-x-1/2 bg-current" />
        </span>
      </span>
    )
  }

  if (kind === 'substitution') {
    return (
      <span className="inline-flex items-center gap-[2px] text-xs font-black leading-none">
        <span className="text-[#7ff0b2]">&uarr;</span>
        <span className="text-[#ff8f8f]">&darr;</span>
      </span>
    )
  }

  if (kind === 'injury') {
    return <span className="text-sm font-black leading-none text-[#f3d36c]">+</span>
  }

  return <span className="text-xs font-black leading-none">EVT</span>
}

type PenaltyShootoutAttempt = {
  attempt: number
  home?: MatchEvent
  away?: MatchEvent
}

function buildPenaltyShootoutAttempts(
  events: MatchEvent[],
  homeTeam: MatchFixture['teams']['home'],
  awayTeam: MatchFixture['teams']['away']
) {
  const attempts = new Map<number, PenaltyShootoutAttempt>()
  const counters = { home: 0, away: 0 }

  const orderedEvents = [...events].sort((a, b) => getEventSortValue(a) - getEventSortValue(b))

  for (const event of orderedEvents) {
    const side = isHomeEvent(event, homeTeam)
      ? 'home'
      : isAwayEvent(event, awayTeam)
        ? 'away'
        : null

    if (!side) continue

    counters[side] += 1
    const attemptNumber = counters[side]
    const current = attempts.get(attemptNumber) ?? { attempt: attemptNumber }

    attempts.set(attemptNumber, {
      ...current,
      [side]: event,
    })
  }

  return [...attempts.values()].sort((a, b) => b.attempt - a.attempt)
}

function getPenaltyPlayerNumber(event: MatchEvent | undefined, lineup?: MatchLineup | null) {
  if (!event?.player || !lineup) return null

  const eventPlayerId = event.player.id ? Number(event.player.id) : null
  const eventPlayerName = normalizeTeamRefName(event.player.name)
  const lineupPlayers = [
    ...(lineup.startXI || []),
    ...(lineup.substitutes || []),
  ]

  const matchedPlayer = lineupPlayers
    .map((wrapper) => wrapper.player)
    .find((player) => {
      if (!player) return false
      if (eventPlayerId !== null && player.id && Number(player.id) === eventPlayerId) return true

      return Boolean(eventPlayerName && normalizeTeamRefName(player.name) === eventPlayerName)
    })

  return matchedPlayer?.number ?? null
}

function PenaltyPlayerNumber({
  number,
  side,
}: {
  number: number | null
  side: 'home' | 'away'
}) {
  if (number === null || number === undefined) return null

  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
        side === 'home'
          ? 'bg-[#079320] text-white'
          : 'bg-[#ecff8c] text-[#0a2319]'
      }`}
    >
      {number}
    </span>
  )
}

function PenaltyOutcomeIcon({ event }: { event?: MatchEvent }) {
  if (!event) return <span className="h-6 w-6" aria-hidden="true" />

  const scored = didPenaltyShootoutEventScore(event)

  if (!scored) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center text-white">
        <EventIcon kind="penalty-missed" />
      </span>
    )
  }

  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#c8f6ce] bg-[#f2ffe9] text-[11px] font-black text-[#0b7a35] shadow-[inset_0_-2px_0_rgba(11,122,53,0.18)]">
      P
    </span>
  )
}

function PenaltyAttemptSide({
  event,
  side,
  lineup,
}: {
  event?: MatchEvent
  side: 'home' | 'away'
  lineup?: MatchLineup | null
}) {
  if (!event) return <div aria-hidden="true" />

  const playerNumber = getPenaltyPlayerNumber(event, lineup)

  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        side === 'away' ? 'justify-end text-right' : ''
      }`}
    >
      {side === 'home' ? (
        <PenaltyPlayerNumber number={playerNumber} side={side} />
      ) : null}
      <span className="min-w-0 truncate text-[13px] font-black text-white md:text-[15px]">
        {event.player?.name || 'Ejecutante'}
      </span>
      {side === 'away' ? (
        <PenaltyPlayerNumber number={playerNumber} side={side} />
      ) : null}
    </div>
  )
}

function PenaltyShootoutBlock({
  events,
  homeTeam,
  awayTeam,
  homeLineup,
  awayLineup,
  homePenaltyScore,
  awayPenaltyScore,
}: {
  events: MatchEvent[]
  homeTeam: MatchFixture['teams']['home']
  awayTeam: MatchFixture['teams']['away']
  homeLineup?: MatchLineup | null
  awayLineup?: MatchLineup | null
  homePenaltyScore: number | null | undefined
  awayPenaltyScore: number | null | undefined
}) {
  const attempts = buildPenaltyShootoutAttempts(events, homeTeam, awayTeam)

  return (
    <div className="border-b border-white/8 bg-[#0d1a14]">
      <div className="grid grid-cols-[1fr_92px_1fr] items-center border-b border-white/8 px-2 py-2 md:grid-cols-[1fr_128px_1fr] md:px-3">
        <div className="text-right text-base font-black text-[#ff6d6d]">
          {homePenaltyScore ?? '-'}
        </div>
        <div className="text-center text-[11px] font-black uppercase tracking-[0.14em] text-white">
          Penales
        </div>
        <div className="text-base font-black text-[#ff6d6d]">
          {awayPenaltyScore ?? '-'}
        </div>
      </div>

      {attempts.length ? (
        attempts.map((attempt) => (
          <div
            key={`penalty-${attempt.attempt}`}
            className="grid grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] items-center border-b border-white/6 px-2 py-2 last:border-b-0 md:grid-cols-[minmax(0,1fr)_116px_minmax(0,1fr)] md:px-3"
          >
            <PenaltyAttemptSide event={attempt.home} side="home" lineup={homeLineup} />
            <div className="grid grid-cols-[26px_28px_26px] items-center justify-center gap-1 text-center md:grid-cols-[30px_32px_30px]">
              <PenaltyOutcomeIcon event={attempt.home} />
              <span className="text-sm font-black text-white md:text-base">
                {attempt.attempt}
              </span>
              <PenaltyOutcomeIcon event={attempt.away} />
            </div>
            <PenaltyAttemptSide event={attempt.away} side="away" lineup={awayLineup} />
          </div>
        ))
      ) : (
        <div className="px-2 py-3 text-center text-sm text-[#8d98a7] md:px-4">
          Definición por penales registrada sin detalle de ejecutantes.
        </div>
      )}
    </div>
  )
}

type TeamStyle = {
  shirt: string
  secondary?: string
  text: string
  border: string
}

type TeamKitColorOverride = MatchTeamKitColors['home']

function normalizeHexColor(value?: string | null) {
  if (!value) return undefined

  const cleaned = value.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return undefined

  return `#${cleaned}`
}

function isLightColor(value: string) {
  const cleaned = value.replace('#', '')
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

  return luminance > 0.78
}

function ensureReadableTeamStyle(style: TeamStyle) {
  if (!isLightColor(style.shirt)) return style

  const fallbackText =
    (style.secondary && !isLightColor(style.secondary) ? style.secondary : undefined) ||
    (style.border && !isLightColor(style.border) ? style.border : undefined) ||
    '#111111'

  return {
    ...style,
    text: fallbackText,
  }
}

function getKitRoleOverride(
  kitColors: TeamKitColorOverride | null | undefined,
  role: 'player' | 'goalkeeper'
) {
  const roleColors = role === 'goalkeeper'
    ? kitColors?.goalkeeper
    : kitColors?.player

  return {
    primary: normalizeHexColor(roleColors?.primary ?? (role === 'player' ? kitColors?.primary : null)),
    secondary: normalizeHexColor(roleColors?.secondary ?? (role === 'player' ? kitColors?.secondary : null)),
    number: normalizeHexColor(roleColors?.number ?? (role === 'player' ? kitColors?.number : null)),
  }
}

function getTeamStyle(
  teamName: string,
  isHome: boolean,
  lineup?: MatchLineup | null,
  role: 'player' | 'goalkeeper' = 'player',
  kitColors?: TeamKitColorOverride | null
): TeamStyle {
  const roleOverride = getKitRoleOverride(kitColors, role)
  const overridePrimary = roleOverride.primary
  const overrideSecondary = roleOverride.secondary
  const overrideNumber = roleOverride.number

  if (overridePrimary || overrideSecondary || overrideNumber) {
    const shirt = overridePrimary || (isHome ? '#14532d' : '#f3f4f6')
    const secondary = overrideSecondary || overridePrimary
    const style = {
      shirt,
      secondary,
      text: overrideNumber || (isLightColor(shirt) ? '#111827' : '#ffffff'),
      border: secondary || (isHome ? '#93c5fd' : '#9ca3af'),
    }

    return overrideNumber ? style : ensureReadableTeamStyle(style)
  }

  const lineupColors = lineup?.team?.colors?.[role]

  const primary = normalizeHexColor(lineupColors?.primary)
  const text = normalizeHexColor(lineupColors?.number)
  const border = normalizeHexColor(lineupColors?.border)

  if (primary || text || border) {
    return ensureReadableTeamStyle({
      shirt: text || primary || (isHome ? '#dc2626' : '#2563eb'),
      secondary: undefined,
      text: primary || '#ffffff',
      border: border || '#ffffff',
    })
  }

  const map: Record<string, TeamStyle> = {
    Independiente: { shirt: '#d90429', text: '#ffffff', border: '#ffffff' },
    'Atenas Río Cuarto': { shirt: '#2563eb', text: '#ffffff', border: '#ffffff' },
    'Atenas Rio Cuarto': { shirt: '#2563eb', text: '#ffffff', border: '#ffffff' },
    River: { shirt: '#ffffff', secondary: '#e5e7eb', text: '#111111', border: '#dc2626' },
    Boca: { shirt: '#1d4ed8', secondary: '#facc15', text: '#facc15', border: '#facc15' },
    Racing: { shirt: '#60a5fa', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    'Racing Club': { shirt: '#60a5fa', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    Estudiantes: { shirt: '#ef4444', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    Talleres: { shirt: '#123c69', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    'San Lorenzo': { shirt: '#1d4ed8', secondary: '#ef4444', text: '#ffffff', border: '#ef4444' },
    'Vélez Sarsfield': { shirt: '#ffffff', secondary: '#1d4ed8', text: '#111111', border: '#1d4ed8' },
    Velez: { shirt: '#ffffff', secondary: '#1d4ed8', text: '#111111', border: '#1d4ed8' },
    Lanus: { shirt: '#7f1d1d', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    'Rosario Central': { shirt: '#1d4ed8', secondary: '#facc15', text: '#facc15', border: '#facc15' },
    "Newell's Old Boys": { shirt: '#111111', secondary: '#ef4444', text: '#ffffff', border: '#ef4444' },
    'Godoy Cruz': { shirt: '#1d4ed8', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    'Argentinos Juniors': { shirt: '#ef4444', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    'Defensa y Justicia': { shirt: '#16a34a', secondary: '#facc15', text: '#ffffff', border: '#facc15' },
    Tigre: { shirt: '#1d4ed8', secondary: '#ef4444', text: '#ffffff', border: '#ef4444' },
    Platense: { shirt: '#ffffff', secondary: '#7f1d1d', text: '#111111', border: '#7f1d1d' },
    Gimnasia: { shirt: '#1f2937', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    Huracan: { shirt: '#ffffff', secondary: '#dc2626', text: '#dc2626', border: '#dc2626' },
    'Barracas Central': { shirt: '#ef4444', secondary: '#ffffff', text: '#ffffff', border: '#ffffff' },
    Botafogo: { shirt: '#111111', secondary: '#ffffff', text: '#ffffff', border: '#d1d5db' },
    Olimpia: { shirt: '#111111', secondary: '#ffffff', text: '#ffffff', border: '#d1d5db' },
    Spain: { shirt: '#ef4444', text: '#ffffff', border: '#facc15' },
    Serbia: { shirt: '#1d4ed8', text: '#ffffff', border: '#ef4444' },
  }

  return ensureReadableTeamStyle(
    map[teamName] || {
      shirt: isHome ? '#14532d' : '#f3f4f6',
      secondary: isHome ? '#2563eb' : '#9ca3af',
      text: isHome ? '#ffffff' : '#111827',
      border: isHome ? '#93c5fd' : '#9ca3af',
    }
  )
}

function parseGrid(grid?: string) {
  if (!grid || !grid.includes(':')) return { row: 1, col: 1 }
  const [row, col] = grid.split(':').map(Number)
  return {
    row: Number.isFinite(row) ? row : 1,
    col: Number.isFinite(col) ? col : 1,
  }
}

function totalRowsFromFormation(formation?: string) {
  if (!formation) return 5
  const lines = formation.split('-').map(Number).filter(Boolean)
  return lines.length + 1
}

const FALLBACK_FIELD_COORDINATES = [
  { x: 50, row: 1 },
  { x: 18, row: 2 },
  { x: 38, row: 2 },
  { x: 62, row: 2 },
  { x: 82, row: 2 },
  { x: 20, row: 3 },
  { x: 40, row: 3 },
  { x: 60, row: 3 },
  { x: 80, row: 3 },
  { x: 34, row: 4 },
  { x: 66, row: 4 },
] as const

function normalizeLineByPosition(pos?: string) {
  const normalized = (pos || '').trim().toUpperCase()

  if (normalized === 'G') return 'G'
  if (normalized === 'D') return 'D'
  if (normalized === 'M') return 'M'
  if (normalized === 'F' || normalized === 'A' || normalized === 'S') return 'F'

  return ''
}

function getInferredFormationPosition(
  players: PlayerWrapper[] | undefined,
  playerWrap: PlayerWrapper
) {
  const starters = players || []
  if (!starters.length) return null

  const grouped = new Map<string, PlayerWrapper[]>()

  for (const starter of starters) {
    const line = normalizeLineByPosition(starter.player?.pos)
    if (!line) continue
    const current = grouped.get(line) || []
    current.push(starter)
    grouped.set(line, current)
  }

  const orderedLines = ['G', 'D', 'M', 'F'].filter((line) => (grouped.get(line) || []).length)
  if (!orderedLines.length) return null

  const playerLine = normalizeLineByPosition(playerWrap.player?.pos)
  if (!playerLine || !grouped.get(playerLine)?.length) return null

  const row = orderedLines.indexOf(playerLine) + 1
  const sameRowPlayers = grouped.get(playerLine) || []
  const col = Math.max(
    1,
    sameRowPlayers.findIndex((candidate) => candidate.player?.id === playerWrap.player?.id) + 1
  )

  return {
    row,
    col,
    sameRowPlayers: sameRowPlayers.length,
    totalRows: orderedLines.length,
  }
}

function getFormationPositionFromIndex(formation: string | undefined, playerIndex = 0) {
  if (!formation) return null

  const lineCounts = [1, ...formation.split('-').map(Number).filter(Boolean)]
  if (lineCounts.length <= 1) return null

  let offset = Math.max(playerIndex, 0)

  for (let rowIndex = 0; rowIndex < lineCounts.length; rowIndex += 1) {
    const sameRowPlayers = lineCounts[rowIndex]
    if (offset < sameRowPlayers) {
      return {
        row: rowIndex + 1,
        col: offset + 1,
        sameRowPlayers,
        totalRows: lineCounts.length,
      }
    }

    offset -= sameRowPlayers
  }

  const lastRowPlayers = lineCounts[lineCounts.length - 1] || 1

  return {
    row: lineCounts.length,
    col: Math.min(lastRowPlayers, Math.max(1, offset + 1)),
    sameRowPlayers: lastRowPlayers,
    totalRows: lineCounts.length,
  }
}

function getPlayerPosition(
  playerWrap: PlayerWrapper,
  formation?: string,
  side: 'top' | 'bottom' = 'top',
  fallbackIndex = 0,
  lineupPlayers?: PlayerWrapper[],
  fullField = false
) {
  const rawGrid = playerWrap.player?.grid
  const hasGrid = Boolean(rawGrid && rawGrid.includes(':'))
  const { row, col } = parseGrid(rawGrid)
  const inferredPosition =
    !hasGrid
      ? getInferredFormationPosition(lineupPlayers, playerWrap) ??
        getFormationPositionFromIndex(formation, fallbackIndex)
      : null
  const totalRows = inferredPosition?.totalRows || totalRowsFromFormation(formation)

  if (!hasGrid && !inferredPosition) {
    const fallback =
      FALLBACK_FIELD_COORDINATES[
        Math.min(Math.max(fallbackIndex, 0), FALLBACK_FIELD_COORDINATES.length - 1)
      ] || FALLBACK_FIELD_COORDINATES[0]

    const fallbackRows = 4
    const normalizedRow = (fallback.row - 1) / Math.max(fallbackRows - 1, 1)
    if (fullField) {
      const start = side === 'top' ? 13 : 87
      const end = side === 'top' ? 87 : 13
      return { x: fallback.x, y: start + normalizedRow * (end - start) }
    }

    const topStart = 10
    const bottomStart = 90
    const halfHeight = 34
    const y = side === 'top' ? topStart + normalizedRow * halfHeight : bottomStart - normalizedRow * halfHeight

    return { x: fallback.x, y }
  }

  const safeRow = Math.min(Math.max(inferredPosition?.row || row, 1), totalRows)

  const sameRowPlayers =
    safeRow <= 1
      ? 1
      : inferredPosition?.sameRowPlayers || Number(formation?.split('-')?.[safeRow - 2] || 1)

  const resolvedCol = inferredPosition?.col || col
  const horizontalPadding = fullField
    ? sameRowPlayers >= 5
      ? 14
      : sameRowPlayers === 4
      ? 15
      : sameRowPlayers === 3
      ? 22
      : 28
    : sameRowPlayers >= 5
    ? 13
    : sameRowPlayers === 4
    ? 15
    : sameRowPlayers === 3
    ? 18
    : 22
  const horizontalSpan = 100 - horizontalPadding * 2

  const x =
    sameRowPlayers <= 1
      ? 50
      : horizontalPadding + ((resolvedCol - 1) / Math.max(sameRowPlayers - 1, 1)) * horizontalSpan

  const normalizedRow = (safeRow - 1) / Math.max(totalRows - 1, 1)
  if (fullField) {
    const start = side === 'top' ? 13 : 87
    const end = side === 'top' ? 87 : 13
    return { x, y: start + normalizedRow * (end - start) }
  }

  const topStart = 12
  const bottomStart = 88
  const halfHeight =
    totalRows >= 5
      ? 34
      : totalRows === 4
      ? 32
      : 30
  const y = side === 'top' ? topStart + normalizedRow * halfHeight : bottomStart - normalizedRow * halfHeight

  return { x, y }
}

function TeamLogo({
  logo,
  name,
  size = 'md',
}: {
  logo?: string
  name: string
  size?: 'sm' | 'md'
}) {
  const classes = size === 'sm' ? 'h-8 w-8' : 'h-[42px] w-[42px] md:h-16 md:w-16'

  return (
    <div className={`flex ${classes} items-center justify-center overflow-hidden`}>
      <AssetTeamLogo
        src={logo}
        alt={name}
        size={size === 'sm' ? 32 : 64}
        className={`${classes} object-contain`}
        fallbackClassName={size === 'sm' ? 'h-7 w-6' : 'h-10 w-8 md:h-14 md:w-12'}
        unoptimized
      />
    </div>
  )
}

function MatchTeamCard({
  id,
  logo,
  name,
  role,
  colors,
  side,
}: {
  id?: number
  logo?: string
  name: string
  role: string
  colors: TeamStyle
  side: 'home' | 'away'
}) {
  const card = (
    <div
      className={`flex h-[94px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition md:h-full md:flex-row md:gap-3 md:rounded-2xl md:px-4 md:py-4 ${
        side === 'away' ? 'md:flex-row-reverse md:text-right' : 'md:text-left'
      }`}
      style={getPanelStyle(colors)}
    >
      <TeamLogo logo={logo} name={name} />
      <div className="min-w-0">
        <p className="line-clamp-2 text-[11px] font-black leading-tight text-white md:truncate md:text-xl">
          {name}
        </p>
        <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#dce5ef] md:mt-1 md:text-xs md:tracking-[0.12em]">
          {role}
        </p>
      </div>
    </div>
  )

  if (!id) return card

  return (
    <Link
      href={`/equipo/${id}`}
      className="block h-[94px] min-w-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7ff0b2] md:h-full md:rounded-2xl"
    >
      {card}
    </Link>
  )
}

function getPanelStyle(style: TeamStyle) {
  const secondary = style.secondary || style.shirt

  return {
    backgroundImage: `linear-gradient(135deg, ${style.shirt}3d 0%, ${secondary}33 52%, rgba(15, 19, 23, 0.94) 100%)`,
    borderColor: `${style.border}66`,
    boxShadow: `inset 0 1px 0 ${style.border}1a`,
  }
}

function MatchSummarySection({
  source,
  isLoading = false,
  error,
  locale,
  shareId,
  shareTitle,
  shareText,
  shareUrl,
  shareFileName,
  className = '',
}: {
  source: MatchSummarySource | null
  isLoading?: boolean
  error?: unknown
  locale: AppLocale
  shareId?: string
  shareTitle?: string
  shareText?: string
  shareUrl?: string
  shareFileName?: string
  className?: string
}) {
  if (!isLoading && (error || !source)) return null

  return (
    <div id={shareId} className={`hf-card w-full overflow-hidden rounded-2xl ${className}`}>
      <div className="hf-section-head px-2 py-3 md:px-4">
        <div className="flex items-center justify-between gap-3">
          <span aria-hidden="true" className="h-10 w-10" />
          <h2 className="text-base font-bold text-white">{t(locale, 'match.summaryTitle')}</h2>
          {shareId && shareTitle && shareText && shareUrl && shareFileName ? (
            <ShareCardButton
              targetId={shareId}
              fileName={shareFileName}
              title={shareTitle}
              text={shareText}
              url={shareUrl}
            />
          ) : (
            <span aria-hidden="true" className="h-10 w-10" />
          )}
        </div>
      </div>

      <div className="p-2 md:p-3">
        <MatchSummaryPlayer source={source} isLoading={isLoading} error={error} />
      </div>
    </div>
  )
}

function getHeadToHeadEmptyMessage(
  readiness: HeadToHeadViewModel['renderReadiness'],
  locale: AppLocale
) {
  if (readiness === 'missing_home_external_id' || readiness === 'missing_away_external_id') {
    return t(locale, 'match.historyUnavailable')
  }

  return t(locale, 'match.noRecentHeadToHead')
}

function MatchHistorySection({
  history,
  homeTeamName,
  awayTeamName,
  shareId,
  shareTitle,
  shareText,
  shareUrl,
  shareFileName,
  historyHref,
  locale,
  preferCountryTeamNames = false,
}: {
  history: HeadToHeadViewModel
  homeTeamName: string
  awayTeamName: string
  shareId: string
  shareTitle: string
  shareText: string
  shareUrl: string
  shareFileName: string
  historyHref: string
  locale: AppLocale
  preferCountryTeamNames?: boolean
}) {
  const latestMatches = history.matches.slice(0, 5)
  const formatHistoryTeamName = (name: string) =>
    preferCountryTeamNames ? translateCountryName(name, locale) || name : name

  return (
    <div id={shareId} className="hf-card w-full overflow-hidden rounded-2xl">
      <div className="hf-section-head px-2 py-3 md:px-4">
        <div className="flex items-center justify-between gap-3">
          <span aria-hidden="true" className="h-10 w-10" />
          <div className="min-w-0 text-center">
            <h2 className="text-lg font-bold tracking-[0.01em] text-white">
              {t(locale, 'match.historyTitle')}
            </h2>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-[#8d98a7]">
              {t(locale, 'match.historySubtitle')}
            </p>
          </div>
          <ShareCardButton
            targetId={shareId}
            fileName={shareFileName}
            title={shareTitle}
            text={shareText}
            url={shareUrl}
          />
        </div>
      </div>

      {latestMatches.length ? (
        <div className="p-2 md:p-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/6 bg-[#13181d] px-2 py-2 text-center">
              <p className="text-lg font-black text-white">{history.summary.homePerspectiveWins}</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[#8d98a7]">
                {homeTeamName}
              </p>
            </div>
            <div className="rounded-xl border border-white/6 bg-[#13181d] px-2 py-2 text-center">
              <p className="text-lg font-black text-white">{history.summary.draws}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8d98a7]">
                {t(locale, 'match.draws')}
              </p>
            </div>
            <div className="rounded-xl border border-white/6 bg-[#13181d] px-2 py-2 text-center">
              <p className="text-lg font-black text-white">{history.summary.awayPerspectiveWins}</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[#8d98a7]">
                {awayTeamName}
              </p>
            </div>
          </div>

          <div className="mt-2 rounded-xl border border-white/6 bg-[#13181d] px-3 py-2 text-center text-xs font-semibold text-[#c8d0da]">
            {history.summary.total} {t(locale, 'home.matchPlural')} · {t(locale, 'match.goals')} {homeTeamName}: {history.summary.homePerspectiveGoals} · {awayTeamName}: {history.summary.awayPerspectiveGoals}
          </div>

          <div className="mt-2 divide-y divide-white/7 overflow-hidden rounded-xl border border-white/6 bg-[#10151a]">
            {latestMatches.map((match) => {
              const historyHomeName = formatHistoryTeamName(match.homeTeam.name)
              const historyAwayName = formatHistoryTeamName(match.awayTeam.name)

              return (
                <article
                  key={`${match.fixtureExternalId ?? match.date}-${match.homeTeam.name}-${match.awayTeam.name}`}
                  className="px-2 py-2"
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-[#8d98a7]">
                    <span className="truncate">{formatMatchDateTimeArgentina(match.date)}</span>
                    <span className="truncate text-right">{match.leagueName}</span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <div className="flex min-w-0 items-center justify-end gap-1.5 text-right">
                      <span className="truncate text-xs font-bold text-white">{historyHomeName}</span>
                      <AssetTeamLogo
                        src={match.homeLogoUrl}
                        alt={historyHomeName}
                        size={22}
                        className="h-[22px] w-[22px] object-contain"
                        fallbackClassName="h-5 w-4"
                        unoptimized
                      />
                    </div>
                    <span className="min-w-[58px] rounded-lg border border-white/8 bg-black/30 px-2 py-1 text-center text-xs font-black text-white">
                      {match.scoreLabel}
                    </span>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <AssetTeamLogo
                        src={match.awayLogoUrl}
                        alt={historyAwayName}
                        size={22}
                        className="h-[22px] w-[22px] object-contain"
                        fallbackClassName="h-5 w-4"
                        unoptimized
                      />
                      <span className="truncate text-xs font-bold text-white">{historyAwayName}</span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          <Link
            href={historyHref}
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-[#25553d] bg-[#163828] px-3 py-2 text-sm font-black text-[#7ff0b2] transition hover:border-[#7ff0b2]/60 hover:bg-[#1b4a32]"
            data-share-exclude="true"
            data-share-ignore="true"
          >
            {t(locale, 'match.fullHistory')}
          </Link>
        </div>
      ) : (
        <div className="px-3 py-5 text-sm text-[#8d98a7] md:px-4">
          <p>{getHeadToHeadEmptyMessage(history.renderReadiness, locale)}</p>
          {history.cacheKey ? (
            <p className="mt-2 text-xs text-[#607083]">
              Cache: {history.cacheKey}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}

function Shirt({ number, style }: { number?: number | string; style: TeamStyle }) {
  return (
    <div
      className="flex h-8 w-6 items-center justify-center text-[10px] font-black sm:h-12 sm:w-10 sm:text-[15px]"
      style={{
        backgroundColor: style.shirt,
        color: style.text,
        clipPath:
          'polygon(18% 0%, 36% 0%, 40% 12%, 60% 12%, 64% 0%, 82% 0%, 100% 18%, 86% 28%, 86% 100%, 14% 100%, 14% 28%, 0% 18%)',
      }}
    >
      {number || ''}
    </div>
  )
}

function getStyleForPlayer(
  playerWrap: PlayerWrapper,
  teamName: string,
  isHome: boolean,
  lineup?: MatchLineup | null,
  kitColors?: TeamKitColorOverride | null
) {
  const role = playerWrap.player?.pos === 'G' ? 'goalkeeper' : 'player'
  return getTeamStyle(teamName, isHome, lineup, role, kitColors)
}

function isCaptainFlag(value: boolean | string | undefined) {
  if (value === true) return true
  if (typeof value !== 'string') return false

  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === 'yes' || normalized === '1'
}

function getCaptainReference(lineup?: MatchLineup | null) {
  const starters = lineup?.startXI || []
  const explicitCaptain = starters.find(
    (playerWrap) =>
      isCaptainFlag(playerWrap.captain) ||
      isCaptainFlag(playerWrap.player?.captain)
  )

  if (explicitCaptain?.player) {
    return {
      id: explicitCaptain.player.id,
      name: explicitCaptain.player.name,
    }
  }

  return undefined
}

type PlayerFieldState = {
  displayName: string
  displayNumber?: number
  activePlayerId?: number | string | null
  activePlayerName?: string | null
  substitutionMinute?: number | null
  substitutionExtraMinute?: number | null
  substitutionReplacementName?: string | null
  substitutionDirection?: 'in' | 'out'
  goals: number
  penaltyGoals: number
  ownGoals: number
  missedPenalties: number
  yellowCards: number
  redCards: number
}

type LineupPlayerLookup = {
  id?: number | string | null
  name?: string | null
}

type SubstitutionMap = ReturnType<typeof getSubstitutionMap>

function normalizePlayerLookupId(value?: number | string | null) {
  if (value === null || value === undefined) return ''

  return String(value).trim()
}

function getPlayerSubstitutionEvents(
  player: LineupPlayerLookup,
  substitutionMap: SubstitutionMap
) {
  const playerId = normalizePlayerLookupId(player.id)
  const playerKey = normalizeFootballEventText(player.name)
  const playerRef = normalizeFootballPersonRef(player.name)

  return {
    playerOutEvent:
      (playerId ? substitutionMap.byPlayerOutId.get(playerId) : null) ||
      (playerKey ? substitutionMap.byPlayerOutName.get(playerKey) : null) ||
      (playerRef ? substitutionMap.byPlayerOutName.get(playerRef) : null) ||
      null,
    playerInEvent:
      (playerId ? substitutionMap.byPlayerInId.get(playerId) : null) ||
      (playerKey ? substitutionMap.byPlayerInName.get(playerKey) : null) ||
      (playerRef ? substitutionMap.byPlayerInName.get(playerRef) : null) ||
      null,
  }
}

function findLineupPlayerByRef(
  players: PlayerWrapper[],
  lookup: LineupPlayerLookup
) {
  const lookupId = normalizePlayerLookupId(lookup.id)
  const lookupName = normalizeFootballEventText(lookup.name)
  const lookupRef = normalizeFootballPersonRef(lookup.name)

  return players.find((playerWrap) => {
    const player = playerWrap.player
    const playerId = normalizePlayerLookupId(player?.id)
    if (lookupId && playerId && lookupId === playerId) return true

    const playerName = normalizeFootballEventText(player?.name)
    if (lookupName && playerName && lookupName === playerName) return true

    const playerRef = normalizeFootballPersonRef(player?.name)
    return Boolean(lookupRef && playerRef && lookupRef === playerRef)
  }) ?? null
}

function getPlayerFieldState(
  playerWrap: PlayerWrapper,
  teamId: number | string | null | undefined,
  events: MatchEvent[],
  substitutionContext: {
    starters?: Array<{ id?: number | null; name?: string | null }>
    substitutes?: Array<{ id?: number | null; name?: string | null }>
    substitutePlayers?: PlayerWrapper[]
  } = {}
): PlayerFieldState {
  const basePlayer = playerWrap.player || {}
  const displayName = basePlayer.name || 'Jugador'
  const displayNumber = basePlayer.number
  const substitutionMap = getSubstitutionMap(events, {
    starters: substitutionContext.starters,
    substitutes: substitutionContext.substitutes,
  })
  const { playerOutEvent: substitutionEvent } = getPlayerSubstitutionEvents(basePlayer, substitutionMap)
  const substitutePlayers = substitutionContext.substitutePlayers ?? []
  const replacementPlayerWrap = substitutionEvent
    ? findLineupPlayerByRef(substitutePlayers, {
        id: substitutionEvent.playerInId,
        name: substitutionEvent.playerInName,
      })
    : null
  const activePlayer = replacementPlayerWrap?.player ?? (
    substitutionEvent?.playerInName
      ? {
          id: substitutionEvent.playerInId,
          name: substitutionEvent.playerInName,
          number: undefined,
        }
      : basePlayer
  )
  const activeDisplayName = activePlayer.name || displayName

  const incidents = getPlayerIncidentsForLineup(
    { id: activePlayer.id, name: activeDisplayName },
    teamId,
    events
  )

  return {
    displayName: abbreviatePlayerName(activeDisplayName),
    displayNumber: activePlayer.number ?? displayNumber,
    activePlayerId: activePlayer.id ?? basePlayer.id ?? null,
    activePlayerName: activeDisplayName,
    substitutionMinute: substitutionEvent?.minute ?? null,
    substitutionExtraMinute: substitutionEvent?.extraMinute ?? null,
    substitutionReplacementName: substitutionEvent?.playerOutName
      ? abbreviatePlayerName(substitutionEvent.playerOutName)
      : null,
    substitutionDirection: substitutionEvent ? 'in' : undefined,
    goals: incidents.filter((incident) => incident.kind === 'goal').length,
    penaltyGoals: incidents.filter((incident) => incident.kind === 'penalty-goal').length,
    ownGoals: incidents.filter((incident) => incident.kind === 'own-goal').length,
    missedPenalties: incidents.filter((incident) => incident.kind === 'penalty-missed').length,
    yellowCards: incidents.filter((incident) => incident.kind === 'yellow-card').length,
    redCards: incidents.filter((incident) => (
      incident.kind === 'red-card' ||
      incident.kind === 'second-yellow'
    )).length,
  }
}

function abbreviatePlayerName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return name

  const lastName = parts[parts.length - 1]
  const firstInitial = parts[0]?.[0]

  return firstInitial ? `${firstInitial}. ${lastName}` : lastName
}

function incidenceSlots(count: number) {
  return Array.from({ length: count })
}

function FieldSideIncidences({
  goals,
  penaltyGoals,
  ownGoals,
  missedPenalties,
  yellowCards,
  redCards,
}: {
  goals: number
  penaltyGoals: number
  ownGoals: number
  missedPenalties: number
  yellowCards: number
  redCards: number
}) {
  if (!goals && !penaltyGoals && !ownGoals && !missedPenalties && !yellowCards && !redCards) {
    return null
  }

  return (
    <div className="absolute left-[calc(50%+16px)] top-1/2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap text-left sm:left-[calc(50%+27px)] sm:gap-1.5">
      {incidenceSlots(goals).map((_, index) => (
        <span key={`goal-${index}`} className="inline-flex items-center gap-0.5 text-[9px] font-black text-white sm:text-[11px]">
          <EventIcon kind="goal" size="lg" />
        </span>
      ))}
      {incidenceSlots(penaltyGoals).map((_, index) => (
        <span key={`penalty-goal-${index}`} className="inline-flex items-center gap-0.5 text-[9px] font-black text-white sm:text-[11px]" title="Gol de penal">
          <EventIcon kind="penalty-goal" size="lg" />
        </span>
      ))}
      {incidenceSlots(ownGoals).map((_, index) => (
        <span key={`own-goal-${index}`} className="inline-flex rounded bg-[#3b1919] px-1 py-0.5 text-[8px] font-black uppercase leading-none text-[#ffb3b3] sm:text-[10px]" title="Gol en contra">
          e/c
        </span>
      ))}
      {incidenceSlots(missedPenalties).map((_, index) => (
        <span key={`missed-penalty-${index}`} className="inline-flex items-center gap-0.5 text-[9px] font-black text-[#ffb3b3] sm:text-[11px]">
          <EventIcon kind="penalty-missed" />
        </span>
      ))}
      {incidenceSlots(yellowCards).map((_, index) => (
        <span key={`yellow-${index}`} className="inline-flex items-center gap-0.5 text-[9px] font-black text-[#f3d36c] sm:text-[11px]">
          <EventIcon kind="yellow-card" />
        </span>
      ))}
      {incidenceSlots(redCards).map((_, index) => (
        <span key={`red-${index}`} className="inline-flex items-center gap-0.5 text-[9px] font-black text-[#ff8f8f] sm:text-[11px]">
          <EventIcon kind="red-card" />
        </span>
      ))}
    </div>
  )
}

function FieldSubstitutionBadge({
  substitutionMinute,
  substitutionExtraMinute,
  substitutionReplacementName,
  substitutionDirection = 'out',
}: {
  substitutionMinute?: number | null
  substitutionExtraMinute?: number | null
  substitutionReplacementName?: string | null
  substitutionDirection?: 'in' | 'out'
}) {
  if (substitutionMinute === null || substitutionMinute === undefined) return null
  const isSubstitutedIn = substitutionDirection === 'in'

  return (
    <div className="mt-0.5 max-w-[76px] text-center leading-tight sm:max-w-[104px]">
      <div
        className={`text-[9px] font-black sm:text-[11px] ${
          isSubstitutedIn ? 'text-[#7ff0b2]' : 'text-[#ff8f8f]'
        }`}
      >
        {isSubstitutedIn ? <>&uarr;</> : <>&darr;</>} {formatEventMinute(substitutionMinute, substitutionExtraMinute)}
      </div>
      {substitutionReplacementName ? (
        <div className="truncate text-[8px] font-semibold text-[#9fb0c2] sm:text-[9px]">
          por {substitutionReplacementName}
        </div>
      ) : null}
    </div>
  )
}

function CaptainBadge() {
  return (
    <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-[#f3d36c] bg-[#5b4a16] px-0.5 text-[8px] font-black uppercase tracking-[0.04em] text-[#ffe38a] shadow-[0_0_0_1px_rgba(0,0,0,0.28)] sm:h-4 sm:min-w-4 sm:px-1 sm:text-[9px]">
      C
    </span>
  )
}

function PlayerOnField({
  playerWrap,
  formation,
  side,
  teamName,
  teamId,
  isHome,
  lineup,
  kitColors,
  events,
  captainReference,
  playerIndex,
  lineupPlayers,
  fullField = false,
}: {
  playerWrap: PlayerWrapper
  formation?: string
  side: 'top' | 'bottom'
  teamName: string
  teamId?: number | string | null
  isHome: boolean
  lineup?: MatchLineup | null
  kitColors?: TeamKitColorOverride | null
  events: MatchEvent[]
  captainReference?: {
    id?: number
    name?: string
  }
  playerIndex?: number
  lineupPlayers?: PlayerWrapper[]
  fullField?: boolean
}) {
  const pos = getPlayerPosition(playerWrap, formation, side, playerIndex, lineupPlayers, fullField)
  const player = playerWrap.player || {}
  const style = getStyleForPlayer(playerWrap, teamName, isHome, lineup, kitColors)
  const substitutionContext = {
    starters: (lineup?.startXI || []).map((entry) => ({
      id: entry.player?.id ?? null,
      name: entry.player?.name ?? null,
    })),
    substitutes: (lineup?.substitutes || []).map((entry) => ({
      id: entry.player?.id ?? null,
      name: entry.player?.name ?? null,
    })),
    substitutePlayers: lineup?.substitutes || [],
  }
  const playerState = getPlayerFieldState(playerWrap, teamId, events, substitutionContext)
  const captainCandidateId = playerState.activePlayerId ?? player.id
  const captainCandidateName = playerState.activePlayerName ?? player.name
  const isCaptain = Boolean(
    (!playerState.substitutionDirection && (isCaptainFlag(player.captain) || isCaptainFlag(playerWrap.captain))) ||
    (captainReference?.id && captainCandidateId && captainReference.id === captainCandidateId) ||
    (
      !captainReference?.id &&
      captainReference?.name &&
      captainCandidateName &&
      captainReference.name.trim().toLowerCase() === captainCandidateName.trim().toLowerCase()
    )
  )

  return (
    <div
      data-match-detail="formation-player"
      className="absolute w-[88px] -translate-x-1/2 -translate-y-1/2 text-center sm:w-[116px]"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
      }}
    >
      <div className="relative mx-auto flex w-fit max-w-full justify-center">
        {isCaptain ? (
          <div className="absolute -left-2 -top-1 z-10">
            <CaptainBadge />
          </div>
        ) : null}
        <Shirt number={playerState.displayNumber ?? player.number} style={style} />
        <FieldSideIncidences
          goals={playerState.goals}
          penaltyGoals={playerState.penaltyGoals}
          ownGoals={playerState.ownGoals}
          missedPenalties={playerState.missedPenalties}
          yellowCards={playerState.yellowCards}
          redCards={playerState.redCards}
        />
      </div>
      <div className="mx-auto mt-0.5 max-w-[72px] overflow-hidden truncate text-ellipsis whitespace-nowrap text-[9px] font-bold leading-tight text-white sm:mt-1 sm:max-w-[96px] sm:text-xs">
        {playerState.displayName}
      </div>
      <div className="mx-auto flex w-fit justify-center">
                <FieldSubstitutionBadge
                  substitutionMinute={playerState.substitutionMinute}
                  substitutionExtraMinute={playerState.substitutionExtraMinute}
                  substitutionReplacementName={playerState.substitutionReplacementName}
                  substitutionDirection={playerState.substitutionDirection}
                />
      </div>
    </div>
  )
}

function FormationPitch({
  teamName,
  displayName,
  teamLogo,
  formation,
  lineup,
  teamId,
  side,
  isHome,
  kitColors,
  events,
  captainReference,
}: {
  teamName: string
  displayName?: string
  teamLogo?: string
  formation?: string
  lineup?: MatchLineup | null
  teamId?: number | string | null
  side: 'top' | 'bottom'
  isHome: boolean
  kitColors?: TeamKitColorOverride | null
  events: MatchEvent[]
  captainReference?: {
    id?: number
    name?: string
  }
}) {
  const starters = lineup?.startXI || []
  const visibleTeamName = displayName || teamName

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-[#25553d] bg-[linear-gradient(180deg,#163828_0%,#12281d_12%,#0f1317_100%)]">
      <div className="flex items-center justify-between gap-2 border-b border-[#25553d] bg-black/10 px-2 py-2 md:px-4 md:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <TeamLogo logo={teamLogo} name={visibleTeamName} size="sm" />
          <span className="truncate font-bold text-white">{visibleTeamName}</span>
        </div>
        <span className="shrink-0 text-sm font-semibold text-[#dbe7de]">
          {formation || 'Sin formación real'}
        </span>
      </div>

      <div className="relative min-h-[500px] w-full min-w-0 overflow-hidden bg-transparent sm:min-h-[610px] lg:min-h-[680px]">
        <div className="absolute inset-x-0 top-1/2 h-px bg-[#4ea170]/50" />
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#4ea170]/40" />
        <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7ff0b2]/40" />

        <div className="absolute left-1/2 top-0 h-16 w-36 -translate-x-1/2 border-x border-b border-[#4ea170]/40 sm:w-40" />
        <div className="absolute left-1/2 top-0 h-7 w-16 -translate-x-1/2 border-x border-b border-[#4ea170]/40 sm:w-20" />
        <div className="absolute left-1/2 bottom-0 h-16 w-36 -translate-x-1/2 border-x border-t border-[#4ea170]/40 sm:w-40" />
        <div className="absolute left-1/2 bottom-0 h-7 w-16 -translate-x-1/2 border-x border-t border-[#4ea170]/40 sm:w-20" />

        {starters.map((playerWrap, index) => (
          <PlayerOnField
            key={`${playerWrap.player?.id || index}-${side}`}
            playerWrap={playerWrap}
            formation={formation}
            side={side}
            teamName={teamName}
            teamId={teamId}
            isHome={isHome}
            lineup={lineup}
            kitColors={kitColors}
            lineupPlayers={starters}
            events={events}
            captainReference={captainReference}
            playerIndex={index}
            fullField
          />
        ))}
      </div>
    </div>
  )
}

function buildPanelPlayers({
  players,
  events,
  teamName,
  teamId,
  isHome,
  lineup,
  kitColors,
  captainReference,
}: {
  players: PlayerWrapper[]
  events: MatchEvent[]
  teamName: string
  teamId?: number | string | null
  isHome: boolean
  lineup?: MatchLineup | null
  kitColors?: TeamKitColorOverride | null
  captainReference?: {
    id?: number
    name?: string
  }
}) {
  const substitutionContext = {
    starters: (lineup?.startXI || []).map((entry) => ({
      id: entry.player?.id ?? null,
      name: entry.player?.name ?? null,
    })),
    substitutes: (lineup?.substitutes || []).map((entry) => ({
      id: entry.player?.id ?? null,
      name: entry.player?.name ?? null,
    })),
  }
  const substitutionMap = getSubstitutionMap(events, substitutionContext)

  return players.map((playerWrap, index) => {
    const player = playerWrap.player || {}
    const isCaptain = Boolean(
      isCaptainFlag(player.captain) ||
      isCaptainFlag(playerWrap.captain) ||
      (captainReference?.id && player.id && captainReference.id === player.id) ||
      (
        !captainReference?.id &&
        captainReference?.name &&
        player.name &&
        captainReference.name.trim().toLowerCase() === player.name.trim().toLowerCase()
      )
    )
    const { playerOutEvent, playerInEvent } = getPlayerSubstitutionEvents(player, substitutionMap)
    const incidents = getPlayerIncidentsForLineup(
      { id: player.id, name: player.name ?? null },
      teamId,
      events
    )
    const goals = incidents.filter((incident) => incident.kind === 'goal').length
    const penaltyGoals = incidents.filter((incident) => incident.kind === 'penalty-goal').length
    const ownGoals = incidents.filter((incident) => incident.kind === 'own-goal').length
    const missedPenalties = incidents.filter((incident) => incident.kind === 'penalty-missed').length
    const yellowCards = incidents.filter((incident) => incident.kind === 'yellow-card').length
    const redCards = incidents.filter((incident) => (
      incident.kind === 'red-card' ||
      incident.kind === 'second-yellow'
    )).length
    const substitutionDirection: 'in' | 'out' | undefined = playerOutEvent
      ? 'out'
      : playerInEvent
      ? 'in'
      : undefined

    return {
      id: String(player.id || `${teamName}-${index}`),
      name: player.name || 'Jugador',
      number: player.number,
      position: player.pos,
      photo: player.photo,
      style: getStyleForPlayer(playerWrap, teamName, isHome, lineup, kitColors),
      isCaptain,
      goals,
      penaltyGoals,
      ownGoals,
      missedPenalties,
      yellowCards,
      redCards,
      replacedPlayerName:
        playerOutEvent?.playerInName ||
        playerInEvent?.playerOutName ||
        undefined,
      substitutionLabel:
        playerOutEvent?.playerInName
          ? 'por'
          : playerInEvent?.playerOutName
          ? 'por'
          : undefined,
      substitutionDirection,
      substitutionMinute: playerOutEvent?.minute ?? playerInEvent?.minute ?? null,
      substitutionExtraMinute: playerOutEvent?.extraMinute ?? playerInEvent?.extraMinute ?? null,
    }
  })
}

function hasVisualFormation(lineup?: MatchLineup | null) {
  const starters = lineup?.startXI || []
  return starters.length > 0
}

export default async function PartidoDetallePage({ params }: PageProps) {
  const { id } = await params
  const locale = await getRequestLocale()
  let data: Awaited<ReturnType<typeof buildMatchDetailViewModel>>

  try {
    data = await loadMatchDetailPageData(id)
  } catch (error) {
    console.warn('[match-detail-page] No se pudo cargar detalle desde Supabase.', {
      id,
      message: error instanceof Error ? error.message : String(error),
    })

    const message = t(locale, 'home.dataError')

    return (
      <div className="min-h-screen text-white">
        <div className="mx-0 w-full max-w-none px-0 py-3 md:mx-auto md:max-w-6xl md:px-4 md:py-10">
          <div className="w-full rounded-2xl border border-[#5a2a2a] bg-[#3b1919] p-4 md:p-6">
            <h1 className="text-2xl font-black">{t(locale, 'match.detailUnavailable')}</h1>
            <p className="mt-2 text-[#ffd5d5]">{message}</p>
          </div>
        </div>
      </div>
    )
  }

  const fixture = data.fixture as MatchFixture | null

  if (!fixture) {
    return (
      <div className="min-h-screen text-white">
        <div className="mx-0 w-full max-w-none px-0 py-3 md:mx-auto md:max-w-6xl md:px-4 md:py-10">
          <div className="w-full rounded-2xl border border-white/8 bg-[#111418] p-4 md:p-6">
            <h1 className="text-2xl font-black">Partido no encontrado</h1>
            <p className="mt-2 text-[#8d98a7]">No existe información para este partido.</p>
          </div>
        </div>
      </div>
    )
  }

  const homeTeam = fixture.teams.home
  const awayTeam = fixture.teams.away
  const homeTeamDisplayName = getTeamDisplayName(homeTeam.name, fixture, locale)
  const awayTeamDisplayName = getTeamDisplayName(awayTeam.name, fixture, locale)
  const goals = fixture.goals
  const penaltyScore = fixture.score?.penalty ?? { home: null, away: null }
  const status = fixture.fixture.status
  const broadcasters: MatchBroadcaster[] = Array.isArray(data.broadcasters)
    ? data.broadcasters
    : []
  const broadcastLabel = broadcasters.map((broadcaster) => broadcaster.name).join(' / ')
  const primaryBroadcastLogo =
    broadcasters.find((broadcaster) => broadcaster.logoUrl)?.logoUrl ?? null
  const summarySource = data.summary.source
  const stats = Array.isArray(data.statistics) ? data.statistics : []
  const events = data.sourceEvents
  const lineups = data.lineups
  const statPairs = data.statisticsRows
  const disciplinePairs = data.disciplineRows
  const penaltyShootoutEvents = data.penaltyShootoutEvents
  const hasPenaltyShootout = data.hasPenaltyShootout
  const timelineEvents = data.timelineEvents
  const lineupEvents = data.lineupEvents
  const homeLineup = data.homeLineup
  const awayLineup = data.awayLineup
  const homeKitColors = data.teamKitColors?.home ?? null
  const awayKitColors = data.teamKitColors?.away ?? null

  const renderedAt = new Date().toISOString()
  const homeColors = getTeamStyle(homeTeam.name, true, homeLineup, 'player', homeKitColors)
  const awayColors = getTeamStyle(awayTeam.name, false, awayLineup, 'player', awayKitColors)
  const statusDisplayElapsed = getMatchDisplayElapsed(status, events)
  const headerStatusLabel = formatHeaderStatusLabel(
    status.short,
    status.long,
    statusDisplayElapsed,
    fixture.fixture.date
  )
  const headerStatusIsLive = isHeaderLiveStatus(status.short)
  const homeCaptainReference = getCaptainReference(homeLineup)
  const awayCaptainReference = getCaptainReference(awayLineup)
  const homeLineupTeamId = homeTeam.id ?? homeLineup?.team?.id ?? null
  const awayLineupTeamId = awayTeam.id ?? awayLineup?.team?.id ?? null
  const homeHasVisualFormation = hasVisualFormation(homeLineup)
  const awayHasVisualFormation = hasVisualFormation(awayLineup)
  const hasAnyVisualFormation = homeHasVisualFormation || awayHasVisualFormation
  const confirmedLineupPlayers =
    data.renderCounts.startersCount + data.renderCounts.substitutesCount
  const matchIsFinished = isFinishedStatus(status.short) || isFinishedStatus(status.long)
  const lineupStatusLabel = confirmedLineupPlayers > 0
    ? t(locale, 'match.lineupConfirmed')
    : matchIsFinished
      ? t(locale, 'match.lineupUnavailable')
      : t(locale, 'match.lineupUnconfirmed')
  const homeStarterPlayers = buildPanelPlayers({
    players: homeLineup?.startXI || [],
    events: lineupEvents,
    teamName: homeTeam.name,
    teamId: homeLineupTeamId,
    isHome: true,
    lineup: homeLineup,
    kitColors: homeKitColors,
    captainReference: homeCaptainReference,
  })
  const awayStarterPlayers = buildPanelPlayers({
    players: awayLineup?.startXI || [],
    events: lineupEvents,
    teamName: awayTeam.name,
    teamId: awayLineupTeamId,
    isHome: false,
    lineup: awayLineup,
    kitColors: awayKitColors,
    captainReference: awayCaptainReference,
  })
  const homeSubstitutePlayers = buildPanelPlayers({
    players: homeLineup?.substitutes || [],
    events: lineupEvents,
    teamName: homeTeam.name,
    teamId: homeLineupTeamId,
    isHome: true,
    lineup: homeLineup,
    kitColors: homeKitColors,
  })
  const awaySubstitutePlayers = buildPanelPlayers({
    players: awayLineup?.substitutes || [],
    events: lineupEvents,
    teamName: awayTeam.name,
    teamId: awayLineupTeamId,
    isHome: false,
    lineup: awayLineup,
    kitColors: awayKitColors,
  })
  const matchHistoryHref = `/partido/${id}/historial`
  const shareCardId = `match-share-card-${fixture.fixture.id}`
  const summaryShareId = `match-summary-card-${fixture.fixture.id}`
  const timelineShareId = `match-timeline-card-${fixture.fixture.id}`
  const formationShareId = `match-formation-card-${fixture.fixture.id}`
  const statsShareId = `match-stats-card-${fixture.fixture.id}`
  const historyShareId = `match-history-card-${fixture.fixture.id}`
  const matchDetailHref = `/partido/${id}`
  const shareTitle = `${homeTeamDisplayName} vs ${awayTeamDisplayName} | Hay Fulbo`
  const shareText = `${homeTeamDisplayName} ${formatMatchScoreWithPenalties({
    goalsHome: goals.home,
    goalsAway: goals.away,
    homePenaltyScore: penaltyScore.home,
    awayPenaltyScore: penaltyScore.away,
  })} ${awayTeamDisplayName} - ${translateLeagueName(fixture.league.name)}`
  const renderedAtMs = Date.parse(renderedAt)
  const matchKickoffMs = Date.parse(fixture.fixture.date)
  const isMatchInActiveWindow =
    Number.isFinite(matchKickoffMs) &&
    matchKickoffMs <= renderedAtMs + 2 * 60 * 60 * 1000 &&
    matchKickoffMs >= renderedAtMs - 36 * 60 * 60 * 1000
  const shouldRunMatchDetailLiveSync =
    !matchIsFinished && (headerStatusIsLive || isMatchInActiveWindow)
  const matchDetailRefreshIntervalMs = headerStatusIsLive
    ? 15_000
    : shouldRunMatchDetailLiveSync
      ? 30_000
      : 300_000
  const matchDetailInitialSyncMinIntervalMs = headerStatusIsLive ? 15_000 : 30_000
  const matchDetailLiveSyncUrl = shouldRunMatchDetailLiveSync
    ? `/api/match-detail/live-sync?fixture=${fixture.fixture.id}`
    : null

  if (process.env.NODE_ENV === 'development') {
    console.info('[match-detail-render]', {
      fixtureId: fixture.fixture.id,
      events: events.length,
      timelineEvents: data.renderCounts.timelineEvents,
      formationPlayers: data.renderCounts.formationPlayers,
      statisticsTeams: stats.length,
      statisticsRows: data.renderCounts.statisticsRows,
      disciplineRows: disciplinePairs.length,
      lineups: lineups.length,
      starters: data.renderCounts.startersCount,
      substitutes: data.renderCounts.substitutesCount,
    })
  }

  return (
    <div className="min-h-screen text-white">
      <div className="w-full max-w-none px-0 py-3 lg:mx-auto lg:max-w-7xl lg:px-5 lg:py-6">
        <header id={shareCardId} className="hf-hero relative mb-4 w-full overflow-hidden rounded-3xl">
          <div data-share-exclude="true">
            <AutoRefresh
              intervalMs={matchDetailRefreshIntervalMs}
              showButton
              className="absolute right-4 top-16 z-10 md:top-4"
              initialUpdatedAt={renderedAt}
              initialSyncMinIntervalMs={matchDetailInitialSyncMinIntervalMs}
              syncBeforeRefreshUrl={matchDetailLiveSyncUrl}
            />
          </div>

          <div className="relative z-10 border-b border-white/6 px-2 py-3 md:px-4">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7ff0b2]">
                  HF · Hay Fulbo
                </p>
                <h1 className="mt-1 text-base font-bold text-white md:text-xl">
                  {translateLeagueName(fixture.league.name)}
                </h1>
                <p className="mt-2 inline-flex rounded-xl border border-[#25553d] bg-[#163828] px-3 py-1.5 text-xs font-black text-[#b8f7d2] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  {formatHeaderDateTime(fixture.fixture.date, locale)}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <ShareCardButton
                  targetId={shareCardId}
                  fileName={`hay-fulbo-${fixture.fixture.id}.png`}
                  title={shareTitle}
                  text={shareText}
                  url={matchDetailHref}
                />
                <Link
                  href={matchHistoryHref}
                  className="hf-button inline-flex min-h-10 items-center justify-center rounded-xl px-3 py-2 text-sm font-black sm:px-4"
                  data-share-exclude="true"
                >
                  Historial
                </Link>
              </div>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2 py-2.5 md:gap-4 md:px-4 md:py-5">
            <MatchTeamCard
              id={homeTeam.id}
              logo={homeTeam.logo_url ?? homeTeam.logo}
              name={homeTeamDisplayName}
              role={t(locale, 'prode.home')}
              colors={homeColors}
              side="home"
            />

            <div className="flex min-w-[76px] flex-col items-center justify-center text-center md:min-w-[150px] md:self-start md:pt-1">
              <div
                className={`max-w-full truncate text-xs font-black uppercase tracking-[0.08em] md:rounded-md md:border md:border-[#25553d] md:bg-[#163828] md:px-3 md:py-1 md:text-[11px] md:tracking-[0.16em] ${
                  headerStatusIsLive ? 'text-[#7ff0b2]' : 'text-[#dce5ef]'
                }`}
              >
                <LiveMatchClockLabel
                  statusShort={status.short}
                  statusLong={status.long}
                  date={fixture.fixture.date}
                  initialElapsed={statusDisplayElapsed}
                  initialLabel={headerStatusLabel}
                  renderedAt={renderedAt}
                />
              </div>
              <div className="mt-1 whitespace-nowrap text-3xl font-black leading-none tracking-normal text-white md:mt-2 md:text-6xl">
                {formatMatchScoreWithPenalties({
                  goalsHome: goals.home,
                  goalsAway: goals.away,
                  homePenaltyScore: penaltyScore.home,
                  awayPenaltyScore: penaltyScore.away,
                })}
              </div>
            </div>

            <MatchTeamCard
              id={awayTeam.id}
              logo={awayTeam.logo_url ?? awayTeam.logo}
              name={awayTeamDisplayName}
              role={t(locale, 'prode.away')}
              colors={awayColors}
              side="away"
            />
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-1.5 border-t border-white/6 bg-black/20 px-2 py-2 text-center text-[#c8d0da] md:gap-2 md:px-4">
            <div className="min-w-0 rounded-lg border border-white/6 bg-white/[0.025] px-1.5 py-2">
              <span className="block truncate text-[clamp(0.58rem,2vw,0.68rem)] font-black uppercase tracking-[0.08em] text-[#8d98a7]">
                {t(locale, 'match.stadium')}
              </span>
              <strong className="mt-1 block min-w-0 overflow-hidden text-[clamp(0.72rem,2.7vw,0.88rem)] font-semibold leading-tight text-white [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow-wrap:anywhere]">
                {formatVenue(fixture.fixture.venue, locale)}
              </strong>
            </div>
            <div className="min-w-0 rounded-lg border border-white/6 bg-white/[0.025] px-1.5 py-2">
              <span className="block truncate text-[clamp(0.58rem,2vw,0.68rem)] font-black uppercase tracking-[0.08em] text-[#8d98a7]">
                TV
              </span>
              <div className="mt-1 flex min-w-0 items-center justify-center gap-1.5">
                {primaryBroadcastLogo ? (
                  <SafeImage
                    src={primaryBroadcastLogo}
                    alt={broadcastLabel || 'TV'}
                    imageType="broadcast"
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] shrink-0 object-contain"
                    fallbackClassName="h-3.5 w-3.5 shrink-0"
                    unoptimized
                  />
                ) : null}
                <strong className="block min-w-0 overflow-hidden text-[clamp(0.72rem,2.7vw,0.88rem)] font-semibold leading-tight text-white [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow-wrap:anywhere]">
                  {broadcastLabel || t(locale, 'common.notAvailable')}
                </strong>
              </div>
            </div>
            <div className="min-w-0 rounded-lg border border-white/6 bg-white/[0.025] px-1.5 py-2">
              <span className="block truncate text-[clamp(0.58rem,2vw,0.68rem)] font-black uppercase tracking-[0.08em] text-[#8d98a7]">
                {t(locale, 'match.referee')}
              </span>
              <strong className="mt-1 block min-w-0 overflow-hidden text-[clamp(0.72rem,2.7vw,0.88rem)] font-semibold leading-tight text-white [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow-wrap:anywhere]">
                {formatReferee(fixture.fixture.referee, locale)}
              </strong>
            </div>
          </div>
        </header>

        {matchIsFinished && summarySource ? (
          <MatchSummarySection
            source={summarySource}
            locale={locale}
            shareId={summaryShareId}
            shareTitle={`${shareTitle} - ${t(locale, 'match.summaryTitle')}`}
            shareText={`${shareText} | ${t(locale, 'match.summaryTitle')}`}
            shareUrl={matchDetailHref}
            shareFileName={`hay-fulbo-resumen-${fixture.fixture.id}.png`}
            className="mb-4"
          />
        ) : null}

        {process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_SHOW_MATCH_DEBUG === 'true' ? (
          <details className="mb-4 rounded-2xl border border-white/8 bg-[#0f1317]/92 px-3 py-2 text-xs text-[#c8d0da]">
            <summary className="cursor-pointer font-bold text-white">Match detail debug</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <span>timelineEvents: {data.renderCounts.timelineEvents}</span>
              <span>formationPlayers: {data.renderCounts.formationPlayers}</span>
              <span>statisticsRows: {data.renderCounts.statisticsRows}</span>
              <span>starters: {data.renderCounts.startersCount}</span>
              <span>substitutes: {data.renderCounts.substitutesCount}</span>
            </div>
          </details>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_320px]">
          <section className="space-y-4">
            <div id={timelineShareId} className="hf-card w-full overflow-hidden rounded-2xl">
              <div className="hf-section-head flex items-center justify-between gap-3 px-2 py-3 md:px-4">
                <span aria-hidden="true" className="h-10 w-10" />
                <h2 className="text-base font-bold text-white">Minuto a minuto</h2>
                <ShareCardButton
                  targetId={timelineShareId}
                  fileName={`hay-fulbo-minuto-a-minuto-${fixture.fixture.id}.png`}
                  title={`${shareTitle} - Minuto a minuto`}
                  text={`${shareText} | Minuto a minuto`}
                  url={matchDetailHref}
                />
              </div>

              {events.length || hasPenaltyShootout ? (
                <div>
                  <div className="grid grid-cols-[1fr_56px_1fr] border-b border-white/6 bg-[#12171c] px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8d98a7] md:grid-cols-[1fr_72px_1fr] md:px-3">
                    <div>{homeTeamDisplayName}</div>
                    <div className="text-center">Min</div>
                    <div className="text-right">{awayTeamDisplayName}</div>
                  </div>

                  {hasPenaltyShootout ? (
                    <PenaltyShootoutBlock
                      events={penaltyShootoutEvents}
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                      homeLineup={homeLineup}
                      awayLineup={awayLineup}
                      homePenaltyScore={penaltyScore.home}
                      awayPenaltyScore={penaltyScore.away}
                    />
                  ) : null}

                  {timelineEvents.map((event, index) => {
                    const isHome = isHomeEvent(event, homeTeam)
                    const isAway = isAwayEvent(event, awayTeam)
                    const renderOnHomeSide = isHome || !isAway
                    const minuteLabel = formatEventMinute(
                      event.time?.elapsed,
                      event.time?.extra
                    )
                    const style = getEventTypeStyle(event)

                    return (
                      <div
                        data-match-detail="timeline-event"
                        key={`${event.time?.elapsed || 'x'}-${event.time?.extra || 0}-${index}`}
                        className="grid grid-cols-[1fr_56px_1fr] items-center border-b border-white/6 px-2 py-2 last:border-b-0 md:grid-cols-[1fr_72px_1fr] md:px-3"
                        >
                        <div className="min-w-0 pr-3">
                          {renderOnHomeSide ? (
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex min-h-4 min-w-4 items-center justify-center ${style.accent}`}>
                                <EventIcon kind={style.kind} />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-semibold text-white">
                                  {getEventPrimary(event)}
                                </p>
                                <p className="truncate text-[11px] text-[#8d98a7]">
                                  {getEventSecondary(event)}
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="text-center">
                          <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${style.badge}`}>
                            {minuteLabel}
                          </span>
                        </div>

                        <div className="min-w-0 pl-3">
                          {isAway ? (
                            <div className="flex items-center justify-end gap-2 text-right">
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-semibold text-white">
                                  {getEventPrimary(event)}
                                </p>
                                <p className="truncate text-[11px] text-[#8d98a7]">
                                  {getEventSecondary(event)}
                                </p>
                              </div>
                              <span className={`inline-flex min-h-4 min-w-4 items-center justify-center ${style.accent}`}>
                                <EventIcon kind={style.kind} />
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}

                  {!timelineEvents.length && !hasPenaltyShootout ? (
                    <div className="px-2 py-5 text-sm text-[#8d98a7] md:px-4">
                      No hay eventos disponibles.
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="px-2 py-5 text-sm text-[#8d98a7] md:px-4">
                  No hay eventos disponibles.
                </div>
              )}
            </div>

            <div id={formationShareId} className="hf-card w-full overflow-hidden rounded-2xl">
              <div className="hf-section-head flex items-center justify-between gap-3 px-2 py-3 md:px-4">
                <h2 className="text-base font-bold text-white">Alineaciones</h2>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase tracking-[0.03em] text-[#b8f7d2]">
                    {lineupStatusLabel}
                  </span>
                  <ShareCardButton
                    targetId={formationShareId}
                    fileName={`hay-fulbo-formacion-${fixture.fixture.id}.png`}
                    title={`${shareTitle} - Alineaciones`}
                    text={`${shareText} | Alineaciones`}
                    url={matchDetailHref}
                  />
                </div>
              </div>

              {confirmedLineupPlayers > 0 ? (
                <div className="w-full px-0 py-2 md:p-4">
                  {hasAnyVisualFormation ? (
                    <div className="space-y-3">
                      {homeHasVisualFormation && homeLineup ? (
                        <FormationPitch
                          teamName={homeTeam.name}
                          displayName={homeTeamDisplayName}
                          teamLogo={homeTeam.logo_url ?? homeTeam.logo}
                          formation={homeLineup.formation}
                          lineup={homeLineup}
                          teamId={homeLineupTeamId}
                          side="top"
                          isHome
                          kitColors={homeKitColors}
                          events={lineupEvents}
                          captainReference={homeCaptainReference}
                        />
                      ) : null}

                      {awayHasVisualFormation && awayLineup ? (
                        <FormationPitch
                          teamName={awayTeam.name}
                          displayName={awayTeamDisplayName}
                          teamLogo={awayTeam.logo_url ?? awayTeam.logo}
                          formation={awayLineup.formation}
                          lineup={awayLineup}
                          teamId={awayLineupTeamId}
                          side="bottom"
                          isHome={false}
                          kitColors={awayKitColors}
                          events={lineupEvents}
                          captainReference={awayCaptainReference}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/8 bg-[#12171c] px-2 py-3 text-sm text-[#8d98a7] md:px-4 md:py-4">
                      Alineación confirmada sin formación táctica disponible.
                    </div>
                  )}

                  <LineupTabs
                    teams={[
                      {
                        title: homeTeamDisplayName,
                        coachName: homeLineup?.coach?.name,
                        starters: homeStarterPlayers,
                        substitutes: homeSubstitutePlayers,
                        align: 'left',
                      },
                      {
                        title: awayTeamDisplayName,
                        coachName: awayLineup?.coach?.name,
                        starters: awayStarterPlayers,
                        substitutes: awaySubstitutePlayers,
                        align: 'right',
                      },
                    ]}
                  />
                </div>
              ) : (
                <div className="px-2 py-5 text-sm text-[#8d98a7] md:px-4">
                  {lineupStatusLabel}.
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div id={statsShareId} className="w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0f1317]/92">
              <div className="border-b border-white/6 bg-[#13181d] px-2 py-3 md:px-4">
                <div className="flex items-center justify-between gap-3">
                  <span aria-hidden="true" className="h-10 w-10" />
                  <h2 className="text-lg font-bold tracking-[0.01em] text-white">Estadísticas</h2>
                  <ShareCardButton
                    targetId={statsShareId}
                    fileName={`hay-fulbo-estadisticas-${fixture.fixture.id}.png`}
                    title={`${shareTitle} - Estadísticas`}
                    text={`${shareText} | Estadísticas`}
                    url={matchDetailHref}
                  />
                </div>
              </div>

              {statPairs.length ? (
                <div className="space-y-2 px-2 py-2 md:px-3 md:py-3">
                  {statPairs.map((stat, index) => {
                    const homeNumber = parseStatNumber(stat.homeValue)
                    const awayNumber = parseStatNumber(stat.awayValue)
                    const total = homeNumber + awayNumber
                    const splitPoint = total > 0 ? (homeNumber / total) * 100 : 50

                    return (
                      <div
                        data-match-detail="statistics-row"
                        key={`${stat.type}-${index}`}
                        className="rounded-xl border border-white/6 bg-[#13181d] px-2.5 py-2"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-sm font-extrabold text-white">
                            {formatStatValue(stat.homeValue)}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8d98a7]">
                            {translateStatType(stat.type)}
                          </span>
                          <span className="text-sm font-extrabold text-white">
                            {formatStatValue(stat.awayValue)}
                          </span>
                        </div>

                        <div className="relative h-2 overflow-hidden rounded-full bg-[#1b2128]">
                          <div
                            className="absolute left-0 top-0 h-full bg-[linear-gradient(90deg,#2fbf71_0%,#7ff0b2_100%)]"
                            style={{ width: `${splitPoint}%` }}
                          />
                          <div
                            className="absolute right-0 top-0 h-full bg-[linear-gradient(90deg,#c8d0da_0%,#5f6b7a_100%)]"
                            style={{ width: `${100 - splitPoint}%` }}
                          />
                          <div
                            className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 bg-white/25"
                            style={{ left: `calc(${splitPoint}% - 1px)` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-3 px-2 py-5 text-sm text-[#8d98a7] md:px-4">
                  <p>{t(locale, 'match.statsUnavailable')}</p>

                  {disciplinePairs.length ? (
                    <div className="rounded-xl border border-white/6 bg-[#13181d] p-3">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8d98a7]">
                        Disciplina
                      </div>
                      <div className="space-y-2">
                        {disciplinePairs.map((stat, index) => (
                          <div
                            key={`${stat.type}-${index}`}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="font-extrabold text-white">
                              {formatStatValue(stat.homeValue)}
                            </span>
                            <span className="text-center font-bold uppercase tracking-[0.08em] text-[#8d98a7]">
                              {translateStatType(stat.type)}
                            </span>
                            <span className="font-extrabold text-white">
                              {formatStatValue(stat.awayValue)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <MatchHistorySection
              history={data.headToHead}
              homeTeamName={homeTeamDisplayName}
              awayTeamName={awayTeamDisplayName}
              shareId={historyShareId}
              shareTitle={`${shareTitle} - ${t(locale, 'match.historyTitle')}`}
              shareText={`${shareText} | ${t(locale, 'match.historySubtitle')}`}
              shareUrl={matchDetailHref}
              shareFileName={`hay-fulbo-historial-${fixture.fixture.id}.png`}
              historyHref={matchHistoryHref}
              locale={locale}
              preferCountryTeamNames={isInternationalTeamFixture(fixture)}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}
