import type {
  LeagueFixtureEventSummary,
  LeagueFixtureSummary,
  TopPlayerRow,
} from '@/lib/api-football'
import {
  isScoreboardGoalEvent,
  normalizeFootballEventText,
} from '@/shared/utils/football-events'

type CopaArgentinaEventLeaders = {
  scorers: TopPlayerRow[]
  assists: TopPlayerRow[]
  yellowCards: TopPlayerRow[]
  redCards: TopPlayerRow[]
}

type EventLeaderAccumulator = {
  name: string
  teamId?: number
  teamName?: string
  teamLogo?: string
  value: number
}

function isYellowCardEvent(event: LeagueFixtureEventSummary) {
  const type = normalizeFootballEventText(event.type)
  const detail = normalizeFootballEventText(event.detail)

  return (
    type.includes('card') &&
    detail.includes('yellow') &&
    !detail.includes('second yellow') &&
    !detail.includes('red')
  )
}

function isRedCardEvent(event: LeagueFixtureEventSummary) {
  const type = normalizeFootballEventText(event.type)
  const detail = normalizeFootballEventText(event.detail)

  return (
    type.includes('card') &&
    (
      detail.includes('red') ||
      detail.includes('second yellow') ||
      detail.includes('roja')
    )
  )
}

function normalizeLeaderName(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getEventTeam(match: LeagueFixtureSummary, event: LeagueFixtureEventSummary) {
  const eventTeamId = event.teamId === null || event.teamId === undefined
    ? null
    : Number(event.teamId)

  if (event.teamSide === 'home' || eventTeamId === match.homeId) {
    return {
      teamId: match.homeId,
      teamName: match.home,
      teamLogo: match.homeLogo,
    }
  }

  if (event.teamSide === 'away' || eventTeamId === match.awayId) {
    return {
      teamId: match.awayId,
      teamName: match.away,
      teamLogo: match.awayLogo,
    }
  }

  return {
    teamId: eventTeamId || undefined,
    teamName: undefined,
    teamLogo: undefined,
  }
}

function addLeader(
  leaders: Map<string, EventLeaderAccumulator>,
  playerName: string | null | undefined,
  team: Pick<EventLeaderAccumulator, 'teamId' | 'teamName' | 'teamLogo'>
) {
  const name = playerName?.trim()
  if (!name) return

  const key = `${normalizeLeaderName(name)}:${team.teamId || normalizeLeaderName(team.teamName)}`
  const current = leaders.get(key)

  if (current) {
    current.value += 1
    if (!current.teamId && team.teamId) current.teamId = team.teamId
    if (!current.teamName && team.teamName) current.teamName = team.teamName
    if (!current.teamLogo && team.teamLogo) current.teamLogo = team.teamLogo
    return
  }

  leaders.set(key, {
    name,
    teamId: team.teamId,
    teamName: team.teamName,
    teamLogo: team.teamLogo,
    value: 1,
  })
}

function toRows(leaders: Map<string, EventLeaderAccumulator>): TopPlayerRow[] {
  return [...leaders.values()]
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value
      return a.name.localeCompare(b.name, 'es')
    })
    .map((leader) => ({
      name: leader.name,
      teamId: leader.teamId,
      teamName: leader.teamName,
      teamLogo: leader.teamLogo,
      value: leader.value,
    }))
}

export function buildCopaArgentinaEventLeaders(
  fixtures: LeagueFixtureSummary[]
): CopaArgentinaEventLeaders {
  const scorers = new Map<string, EventLeaderAccumulator>()
  const assists = new Map<string, EventLeaderAccumulator>()
  const yellowCards = new Map<string, EventLeaderAccumulator>()
  const redCards = new Map<string, EventLeaderAccumulator>()

  for (const match of fixtures) {
    for (const event of match.events ?? []) {
      const team = getEventTeam(match, event)

      if (isScoreboardGoalEvent(event.type, event.detail)) {
        addLeader(scorers, event.playerName, team)
        addLeader(assists, event.assistName, team)
        continue
      }

      if (isYellowCardEvent(event)) {
        addLeader(yellowCards, event.playerName, team)
        continue
      }

      if (isRedCardEvent(event)) {
        addLeader(redCards, event.playerName, team)
      }
    }
  }

  return {
    scorers: toRows(scorers),
    assists: toRows(assists),
    yellowCards: toRows(yellowCards),
    redCards: toRows(redCards),
  }
}
