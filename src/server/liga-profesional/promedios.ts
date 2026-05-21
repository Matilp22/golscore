import type { LeagueFixtureSummary, LeagueStandingGroup, LeagueStandingRow } from '@/lib/api-football'
import {
  LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID,
  getLeagueFinalPhaseKey,
  normalizeRoundText,
} from '@/shared/utils/league-rounds'
import { isFinishedStatus } from '@/shared/utils/match-status'

type AnnualAccumulator = Omit<LeagueStandingRow, 'rank'>
type FetchLeagueFixtures = (
  leagueExternalId: number,
  season: number
) => Promise<LeagueFixtureSummary[]>

export const COPA_DE_LA_LIGA_PROFESIONAL_EXTERNAL_ID = 1032

export type LigaProfesionalPromedioSource = {
  season: number
  leagueExternalId: number
  label: string
}

export type LigaProfesionalPromedioSeasonStanding = {
  season: number
  standings: LeagueStandingGroup[]
  sources: Array<LigaProfesionalPromedioSource & { fixtures: number; annualFixtures: number }>
  warnings: string[]
}

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

export function isAnnualTableFixtureRound(round: string | null | undefined) {
  const normalized = normalizeRoundText(round)

  if (!normalized) return true
  if (getLeagueFinalPhaseKey(normalized)) return false

  return !(
    /\b(playoff|play-off|play offs|play-offs|reducido|liguilla|promotion|promocion)\b/.test(normalized) ||
    /\b(round of 16|8th finals?|16th finals?|32nd finals?|octavos?|cuartos?|quarter finals?|semi finals?|semifinal(?:es)?|final)\b/.test(normalized)
  )
}

function getFixtureDedupeKey(fixture: LeagueFixtureSummary) {
  if (fixture.id !== undefined && fixture.id !== null && String(fixture.id).trim()) {
    return `id:${fixture.id}`
  }

  return [
    fixture.date ?? '',
    getTeamKey(fixture.homeId, fixture.home),
    getTeamKey(fixture.awayId, fixture.away),
    normalizeRoundText(fixture.round),
  ].join('|')
}

function getFixtureDataScore(fixture: LeagueFixtureSummary) {
  let score = 0

  if (isFinishedStatus(fixture.statusShort)) score += 10
  if (fixture.goalsHome !== null && fixture.goalsAway !== null) score += 5
  if (fixture.homeLogo) score += 1
  if (fixture.awayLogo) score += 1

  return score
}

function dedupeFixtures(fixtures: LeagueFixtureSummary[]) {
  const byKey = new Map<string, LeagueFixtureSummary>()

  for (const fixture of fixtures) {
    const key = getFixtureDedupeKey(fixture)
    const current = byKey.get(key)

    if (!current || getFixtureDataScore(fixture) >= getFixtureDataScore(current)) {
      byKey.set(key, fixture)
    }
  }

  return [...byKey.values()]
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

  for (const fixture of dedupeFixtures(fixtures)) {
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

export function getLigaProfesionalPromedioSources(
  season: number,
  primaryLeagueExternalId = LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID
): LigaProfesionalPromedioSource[] {
  if (season === 2024) {
    return [
      {
        season,
        leagueExternalId: COPA_DE_LA_LIGA_PROFESIONAL_EXTERNAL_ID,
        label: 'Copa de la Liga Profesional 2024',
      },
      {
        season,
        leagueExternalId: primaryLeagueExternalId,
        label: 'Liga Profesional 2024',
      },
    ]
  }

  return [
    {
      season,
      leagueExternalId: primaryLeagueExternalId,
      label: `Liga Profesional ${season}`,
    },
  ]
}

export async function buildLigaProfesionalPromediosStandingForSeason(
  season: number,
  fetchLeagueFixtures: FetchLeagueFixtures,
  primaryLeagueExternalId = LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID
): Promise<LigaProfesionalPromedioSeasonStanding> {
  const sourceDefinitions = getLigaProfesionalPromedioSources(season, primaryLeagueExternalId)
  const sourceResults = await Promise.allSettled(
    sourceDefinitions.map(async (source) => ({
      ...source,
      fixtures: await fetchLeagueFixtures(source.leagueExternalId, source.season),
    }))
  )
  const fixtures: LeagueFixtureSummary[] = []
  const warnings: string[] = []
  const sources: LigaProfesionalPromedioSeasonStanding['sources'] = []

  sourceResults.forEach((result, index) => {
    const source = sourceDefinitions[index]

    if (result.status === 'rejected') {
      warnings.push(
        `${source.label} (${source.leagueExternalId}) no se pudo leer: ${
          result.reason instanceof Error ? result.reason.message : String(result.reason)
        }`
      )
      sources.push({ ...source, fixtures: 0, annualFixtures: 0 })
      return
    }

    const sourceFixtures = result.value.fixtures
    const annualFixtures = sourceFixtures.filter((fixture) =>
      isAnnualTableFixtureRound(fixture.round)
    ).length

    fixtures.push(...sourceFixtures)
    sources.push({
      ...source,
      fixtures: sourceFixtures.length,
      annualFixtures,
    })
  })

  return {
    season,
    standings: [buildAnnualStandingGroupFromFixtures(fixtures)],
    sources,
    warnings,
  }
}
