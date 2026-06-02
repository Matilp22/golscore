import {
  getMatchDetail,
  type MatchEvent,
  type MatchFixture,
  type MatchLineup,
  type MatchStatisticsTeam,
  type PlayerWrapper,
} from '@/lib/api-football'
import {
  getTimelineEvents,
  isPenaltyShootoutEvent,
} from '@/shared/utils/football-events'
import { hasPenaltyShootoutScore } from '@/shared/utils/match-display'
import {
  buildDisciplineStatisticsFromEvents,
  normalizeMatchStatistics,
  type NormalizedMatchStatisticPair,
} from '@/shared/utils/match-statistics'

type MatchDetailPayload = Awaited<ReturnType<typeof getMatchDetail>>

export type BuildMatchDetailViewModelInput =
  | string
  | number
  | {
      matchId?: string | number | null
      fixtureExternalId?: string | number | null
    }

export type MatchDetailLineupPlayer = {
  side: 'home' | 'away'
  list: 'starter' | 'substitute'
  teamName: string
  playerWrap: PlayerWrapper
  index: number
}

export type MatchDetailViewModel = MatchDetailPayload & {
  ok: boolean
  rawEvents: MatchEvent[]
  sourceEvents: MatchEvent[]
  timelineEvents: MatchEvent[]
  lineupEvents: MatchEvent[]
  penaltyShootoutEvents: MatchEvent[]
  statisticsRows: NormalizedMatchStatisticPair[]
  disciplineRows: NormalizedMatchStatisticPair[]
  lineups: MatchLineup[]
  homeLineup: MatchLineup | null
  awayLineup: MatchLineup | null
  homeStarters: PlayerWrapper[]
  awayStarters: PlayerWrapper[]
  homeSubstitutes: PlayerWrapper[]
  awaySubstitutes: PlayerWrapper[]
  formationPlayers: MatchDetailLineupPlayer[]
  starters: MatchDetailLineupPlayer[]
  substitutes: MatchDetailLineupPlayer[]
  league: MatchFixture['league'] | null
  formation: {
    home: MatchLineup | null
    away: MatchLineup | null
  }
  lineupsByTeam: {
    home: MatchLineup | null
    away: MatchLineup | null
  }
  match: {
    fixtureId: number | null
    status: string | null
    statusLong: string | null
  }
  teams: MatchFixture['teams'] | null
  homeFormation: string | null
  awayFormation: string | null
  highlights: {
    url: string | null
    title: string | null
  }
  hasPenaltyShootout: boolean
  matchInfo: {
    fixtureId: number | null
    statusShort: string | null
    statusLong: string | null
    elapsed: number | null
    venueName: string | null
    venueCity: string | null
    referee: string | null
  }
  renderCounts: {
    timelineEvents: number
    formationPlayers: number
    statisticsRows: number
    startersCount: number
    substitutesCount: number
  }
  renderReadiness: {
    canRenderTimeline: boolean
    canRenderFormation: boolean
    canRenderStatistics: boolean
    canRenderLineupTabs: boolean
    timeline: boolean
    formation: boolean
    statistics: boolean
    lineups: boolean
  }
  formationStringsMissing: boolean
  missingSections: string[]
  warnings: string[]
  errors: string[]
}

function toFiniteNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function resolveViewModelInput(input: BuildMatchDetailViewModelInput) {
  if (typeof input === 'object' && input !== null) {
    const fixtureExternalId = toFiniteNumber(input.fixtureExternalId)
    const matchId = toFiniteNumber(input.matchId)

    return {
      id: fixtureExternalId ?? matchId,
      requestedId: input.fixtureExternalId ?? input.matchId ?? null,
    }
  }

  return {
    id: toFiniteNumber(input),
    requestedId: input,
  }
}

function createEmptyMatchDetailPayload(): MatchDetailPayload {
  return {
    fixture: null,
    events: [],
    statistics: [],
    lineups: [],
    broadcastChannel: null,
    broadcastLogoUrl: null,
    broadcasters: [],
    highlightsUrl: null,
    highlightsTitle: null,
  }
}

export function normalizeMatchDetailTeamName(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\bjrs\b/gi, 'juniors')
    .replace(/\bjunior\b/gi, 'juniors')
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\b(ca|club|de|del|la|el|fc|ac)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function isSameMatchDetailTeamRef(
  candidate: { id?: number; name?: string } | undefined,
  target: { id?: number; name?: string }
) {
  if (!candidate || !target) return false
  if (candidate.id && target.id && Number(candidate.id) === Number(target.id)) return true

  const candidateName = normalizeMatchDetailTeamName(candidate.name)
  const targetName = normalizeMatchDetailTeamName(target.name)

  return Boolean(
    candidateName &&
    targetName &&
    (
      candidateName === targetName ||
      candidateName.includes(targetName) ||
      targetName.includes(candidateName)
    )
  )
}

export function getMatchDetailLineupsForFixture(
  lineups: MatchLineup[],
  fixture: MatchFixture | null
) {
  if (!fixture) {
    return {
      homeLineup: lineups[0] ?? null,
      awayLineup: lineups[1] ?? null,
    }
  }

  return {
    homeLineup:
      lineups.find((lineup) => isSameMatchDetailTeamRef(lineup.team, fixture.teams.home)) ??
      lineups[0] ??
      null,
    awayLineup:
      lineups.find((lineup) => isSameMatchDetailTeamRef(lineup.team, fixture.teams.away)) ??
      lineups[1] ??
      null,
  }
}

function countPlayers(lineup: MatchLineup | null | undefined, key: 'startXI' | 'substitutes') {
  const players = lineup?.[key]

  return Array.isArray(players) ? players.length : 0
}

function hasFormationString(lineup: MatchLineup | null | undefined) {
  return Boolean(lineup?.formation?.trim())
}

function isLikelyPenaltyShootoutAttempt(event: MatchEvent, hasPenaltyScore: boolean) {
  if (!hasPenaltyScore) return false

  const elapsed = event.time?.elapsed ?? 0
  const extra = event.time?.extra ?? 0
  const text = [
    event.type,
    event.detail,
    event.comments,
  ].join(' ').toLowerCase()

  return elapsed >= 120 && extra > 0 && text.includes('penalty')
}

function mapLineupPlayers(input: {
  players: PlayerWrapper[]
  side: 'home' | 'away'
  list: 'starter' | 'substitute'
  teamName: string
}) {
  return input.players.map((playerWrap, index) => ({
    side: input.side,
    list: input.list,
    teamName: input.teamName,
    playerWrap,
    index,
  }))
}

export function buildMatchDetailViewModelFromDetail(
  detail: MatchDetailPayload,
  options: {
    matchId?: string | number | null
    warnings?: string[]
    errors?: string[]
  } = {}
): MatchDetailViewModel {
  const fixture = detail.fixture as MatchFixture | null
  const rawEvents: MatchEvent[] = Array.isArray(detail.events) ? detail.events : []
  const lineups: MatchLineup[] = Array.isArray(detail.lineups) ? detail.lineups : []
  const statistics: MatchStatisticsTeam[] = Array.isArray(detail.statistics)
    ? detail.statistics
    : []
  const matchId = options.matchId ?? fixture?.fixture.id ?? null
  const sourceEvents = getTimelineEvents(rawEvents, {
    descending: false,
    excludePenaltyShootout: false,
    matchId,
    semanticDedupe: true,
  })
  const penaltyScore = fixture?.score?.penalty ?? { home: null, away: null }
  const hasPenaltyScore = hasPenaltyShootoutScore(penaltyScore.home, penaltyScore.away)
  const penaltyShootoutEvents = sourceEvents.filter((event) =>
    isPenaltyShootoutEvent(event) ||
    isLikelyPenaltyShootoutAttempt(event, hasPenaltyScore)
  )
  const hasPenaltyShootout = hasPenaltyScore || penaltyShootoutEvents.length > 0
  const regularEvents = sourceEvents.filter((event) =>
    !isPenaltyShootoutEvent(event) &&
    !isLikelyPenaltyShootoutAttempt(event, hasPenaltyScore)
  )
  const timelineEvents = getTimelineEvents(regularEvents, {
    matchId,
    semanticDedupe: true,
  })
  const lineupEvents = getTimelineEvents(regularEvents, {
    descending: false,
    matchId,
    semanticDedupe: true,
  })
  const statisticsRows = fixture
    ? normalizeMatchStatistics(
        statistics,
        fixture.teams.home,
        fixture.teams.away,
        sourceEvents
      )
    : []
  const disciplineRows = fixture && !statisticsRows.length
    ? buildDisciplineStatisticsFromEvents(sourceEvents, fixture.teams.home, fixture.teams.away)
    : []
  const { homeLineup, awayLineup } = getMatchDetailLineupsForFixture(lineups, fixture)
  const homeStarters = homeLineup?.startXI || []
  const awayStarters = awayLineup?.startXI || []
  const homeSubstitutes = homeLineup?.substitutes || []
  const awaySubstitutes = awayLineup?.substitutes || []
  const formationPlayers = [
    ...mapLineupPlayers({
      players: homeStarters,
      side: 'home',
      list: 'starter',
      teamName: fixture?.teams.home.name ?? homeLineup?.team?.name ?? 'Local',
    }),
    ...mapLineupPlayers({
      players: awayStarters,
      side: 'away',
      list: 'starter',
      teamName: fixture?.teams.away.name ?? awayLineup?.team?.name ?? 'Visitante',
    }),
  ]
  const starters = formationPlayers
  const substitutes = [
    ...mapLineupPlayers({
      players: homeSubstitutes,
      side: 'home',
      list: 'substitute',
      teamName: fixture?.teams.home.name ?? homeLineup?.team?.name ?? 'Local',
    }),
    ...mapLineupPlayers({
      players: awaySubstitutes,
      side: 'away',
      list: 'substitute',
      teamName: fixture?.teams.away.name ?? awayLineup?.team?.name ?? 'Visitante',
    }),
  ]
  const renderCounts = {
    timelineEvents: timelineEvents.length,
    formationPlayers: formationPlayers.length,
    statisticsRows: statisticsRows.length,
    startersCount: starters.length,
    substitutesCount: substitutes.length,
  }
  const renderReadiness = {
    canRenderTimeline: renderCounts.timelineEvents > 0,
    canRenderFormation: renderCounts.formationPlayers > 0,
    canRenderStatistics: renderCounts.statisticsRows > 0,
    canRenderLineupTabs: renderCounts.startersCount > 0 || renderCounts.substitutesCount > 0,
    timeline: renderCounts.timelineEvents > 0,
    formation: renderCounts.formationPlayers > 0,
    statistics: renderCounts.statisticsRows > 0,
    lineups: renderCounts.startersCount > 0 || renderCounts.substitutesCount > 0,
  }
  const match = {
    fixtureId: fixture?.fixture.id ?? null,
    status: fixture?.fixture.status.short ?? null,
    statusLong: fixture?.fixture.status.long ?? null,
  }
  const matchInfo = {
    fixtureId: fixture?.fixture.id ?? null,
    statusShort: fixture?.fixture.status.short ?? null,
    statusLong: fixture?.fixture.status.long ?? null,
    elapsed: fixture?.fixture.status.elapsed ?? null,
    venueName: fixture?.fixture.venue?.name ?? null,
    venueCity: fixture?.fixture.venue?.city ?? null,
    referee: fixture?.fixture.referee ?? null,
  }
  const highlights = {
    url: typeof detail.highlightsUrl === 'string' ? detail.highlightsUrl : null,
    title: typeof detail.highlightsTitle === 'string' ? detail.highlightsTitle : null,
  }
  const missingSections = [
    !renderCounts.timelineEvents ? 'timeline' : null,
    !renderCounts.formationPlayers ? 'formation' : null,
    !renderCounts.statisticsRows ? 'statistics' : null,
    !renderReadiness.canRenderLineupTabs ? 'lineups' : null,
  ].filter((section): section is string => Boolean(section))

  return {
    ...detail,
    ok: Boolean(fixture),
    rawEvents,
    sourceEvents,
    timelineEvents,
    lineupEvents,
    penaltyShootoutEvents,
    statisticsRows,
    disciplineRows,
    lineups,
    homeLineup,
    awayLineup,
    homeStarters,
    awayStarters,
    homeSubstitutes,
    awaySubstitutes,
    formationPlayers,
    starters,
    substitutes,
    league: fixture?.league ?? null,
    formation: {
      home: homeLineup,
      away: awayLineup,
    },
    lineupsByTeam: {
      home: homeLineup,
      away: awayLineup,
    },
    match,
    teams: fixture?.teams ?? null,
    homeFormation: homeLineup?.formation?.trim() || null,
    awayFormation: awayLineup?.formation?.trim() || null,
    highlights,
    hasPenaltyShootout,
    matchInfo,
    renderCounts,
    renderReadiness,
    formationStringsMissing:
      renderCounts.formationPlayers > 0 &&
      (!hasFormationString(homeLineup) || !hasFormationString(awayLineup)),
    missingSections,
    warnings: options.warnings ?? [],
    errors: options.errors ?? [],
  }
}

export async function buildMatchDetailViewModel(input: BuildMatchDetailViewModelInput) {
  const resolved = resolveViewModelInput(input)
  const warnings = resolved.id === null
    ? ['No se pudo resolver un fixtureExternalId numerico para el detalle de partido.']
    : []
  const detail = resolved.id !== null
    ? await getMatchDetail(resolved.id)
    : createEmptyMatchDetailPayload()

  return buildMatchDetailViewModelFromDetail(detail, {
    matchId: resolved.id ?? resolved.requestedId,
    warnings,
  })
}

export function countMatchDetailLineupPlayers(
  lineup: MatchLineup | null | undefined,
  key: 'startXI' | 'substitutes'
) {
  return countPlayers(lineup, key)
}
