import type { LeagueFixtureSummary, LeagueStandingGroup, LeagueStandingRow } from '@/lib/api-football'
import {
  getLeagueFinalPhaseKey,
  normalizeRoundText,
} from '@/shared/utils/league-rounds'
import { isFinishedStatus } from '@/shared/utils/match-status'

type AnnualAccumulator = Omit<LeagueStandingRow, 'rank'>

function normalizeTeamNameKey(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getTeamKey(teamId: number | undefined, teamName: string) {
  return teamId !== undefined && teamId !== null
    ? `id:${teamId}`
    : `name:${normalizeTeamNameKey(teamName)}`
}

function isAnnualTableFixtureRound(round: string | null | undefined) {
  const normalized = normalizeRoundText(round)

  if (!normalized) return true
  if (getLeagueFinalPhaseKey(normalized)) return false

  return !(
    /\b(playoff|play-off|play offs|play-offs|reducido|liguilla|promotion|promocion)\b/.test(normalized) ||
    /\b(round of 16|8th finals?|16th finals?|32nd finals?|octavos?|cuartos?|quarter finals?|semi finals?|semifinal(?:es)?|final)\b/.test(normalized)
  )
}

function getAccumulator(
  table: Map<string, AnnualAccumulator>,
  teamId: number | undefined,
  teamName: string,
  teamLogo?: string | null
) {
  const key = getTeamKey(teamId, teamName)
  const current = table.get(key)

  if (current) {
    if (!current.teamLogo && teamLogo) current.teamLogo = teamLogo
    return current
  }

  const row: AnnualAccumulator = {
    teamId,
    teamName,
    teamLogo: teamLogo ?? undefined,
    points: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
  }

  table.set(key, row)
  return row
}

function applyFixtureResult(
  home: AnnualAccumulator,
  away: AnnualAccumulator,
  homeGoals: number,
  awayGoals: number
) {
  home.played += 1
  away.played += 1
  home.goalsFor += homeGoals
  home.goalsAgainst += awayGoals
  away.goalsFor += awayGoals
  away.goalsAgainst += homeGoals
  home.goalDifference = home.goalsFor - home.goalsAgainst
  away.goalDifference = away.goalsFor - away.goalsAgainst

  if (homeGoals > awayGoals) {
    home.won += 1
    away.lost += 1
    home.points += 3
    return
  }

  if (awayGoals > homeGoals) {
    away.won += 1
    home.lost += 1
    away.points += 3
    return
  }

  home.drawn += 1
  away.drawn += 1
  home.points += 1
  away.points += 1
}

export function buildAnnualRowsFromFixtures(fixtures: LeagueFixtureSummary[]) {
  const table = new Map<string, AnnualAccumulator>()

  for (const fixture of fixtures) {
    if (!isAnnualTableFixtureRound(fixture.round)) continue
    if (!isFinishedStatus(fixture.statusShort)) continue
    if (fixture.goalsHome === null || fixture.goalsAway === null) continue

    const home = getAccumulator(table, fixture.homeId, fixture.home, fixture.homeLogo)
    const away = getAccumulator(table, fixture.awayId, fixture.away, fixture.awayLogo)

    applyFixtureResult(home, away, fixture.goalsHome, fixture.goalsAway)
  }

  return [...table.values()]
    .filter((row) => row.played > 0)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
      return a.teamName.localeCompare(b.teamName, 'es-AR')
    })
    .map((row, index): LeagueStandingRow => ({
      ...row,
      rank: index + 1,
    }))
}

export function buildAnnualStandingGroupFromFixtures(fixtures: LeagueFixtureSummary[]): LeagueStandingGroup {
  return {
    name: 'Tabla anual',
    rows: buildAnnualRowsFromFixtures(fixtures),
  }
}
