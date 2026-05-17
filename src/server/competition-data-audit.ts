import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getLeagueFixtures,
  getLeagueStandings,
  type LeagueFixtureSummary,
  type LeagueStandingGroup,
} from '@/lib/api-football'
import { getTournamentChampions } from '@/server/tournament-champions'
import {
  getCompetitionRule,
  getTournamentDisplayOptions,
  type CompetitionRule,
} from '@/shared/config/competition-rules'
import {
  VISIBLE_TOURNAMENT_PAGE_CONFIGS,
  type TournamentPageConfig,
} from '@/shared/config/tournament-pages'
import { getArgentinaDateISO } from '@/shared/utils/argentina-time'
import {
  auditUefaKnockoutRound,
  getUefaLeaguePhaseRoundNumber,
  isUefaLeaguePhaseRound,
} from '@/shared/utils/uefa-rounds'

type DbId = string | number

type LeagueRow = {
  id: DbId
  external_id: string | number | null
  name: string | null
  country: string | null
  season: number | null
}

type CompetitionAuditOptions = {
  competition?: string | null
  leagueExternalId?: string | null
  date?: string | null
}

const PROTECTED_EXTERNAL_IDS: Record<string, number> = {
  'argentina-liga-profesional': 128,
  'argentina-copa-argentina': 130,
}

const UEFA_COMPETITION_KEYS = new Set([
  'internacional-champions',
  'internacional-europa-league',
  'internacional-conference-league',
])

const UEFA_EXPECTATIONS: Record<string, { teams: number; leaguePhaseMatchdays: number }> = {
  'internacional-champions': { teams: 36, leaguePhaseMatchdays: 8 },
  'internacional-europa-league': { teams: 36, leaguePhaseMatchdays: 8 },
  'internacional-conference-league': { teams: 36, leaguePhaseMatchdays: 6 },
}

const CONMEBOL_GROUP_KEYS = new Set([
  'internacional-libertadores',
  'internacional-sudamericana',
])

const KAZAKHSTAN_TEAM_PATTERNS = [
  'astana',
  'kairat',
  'aktobe',
  'ordabasy',
  'tobol',
  'shakhter',
  'taraz',
  'atyrau',
  'kaisat',
  'kaisar',
  'kyzyl',
]

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function getConfiguredExternalIds(tournament: TournamentPageConfig) {
  return getCompetitionRule(tournament.key)?.externalIds ??
    (PROTECTED_EXTERNAL_IDS[tournament.key]
      ? [PROTECTED_EXTERNAL_IDS[tournament.key]]
      : [])
}

function getExpectedFormat(
  tournament: TournamentPageConfig,
  rule: CompetitionRule | null
) {
  if (tournament.key === 'argentina-liga-profesional') {
    return 'groups_plus_knockout'
  }

  if (UEFA_COMPETITION_KEYS.has(tournament.key)) {
    return 'league_phase_plus_knockout'
  }

  if (CONMEBOL_GROUP_KEYS.has(tournament.key) || tournament.key === 'selecciones-mundial') {
    return 'groups_plus_knockout'
  }

  if (rule?.standingsMode === 'none' && rule.showBracket) return 'knockout_cup'
  if (rule?.standingsMode === 'groups') return 'groups'
  if (rule?.standingsMode === 'conferences') return 'conferences_plus_playoffs'
  if (rule?.showBracket && rule.standingsMode === 'single') return 'regular_season_plus_playoffs'
  if (rule?.standingsMode === 'single') return 'league_table'

  return rule?.configuredType ?? 'unknown'
}

function getExpectedRounds(tournament: TournamentPageConfig, rule: CompetitionRule | null) {
  if (UEFA_COMPETITION_KEYS.has(tournament.key)) {
    return ['Fase liga', 'Playoffs', 'Octavos', 'Cuartos', 'Semifinales', 'Final']
  }

  if (tournament.key === 'selecciones-mundial') {
    return ['Grupos', 'Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinales', 'Final']
  }

  if (CONMEBOL_GROUP_KEYS.has(tournament.key)) {
    return ['Grupos', 'Octavos', 'Cuartos', 'Semifinales', 'Final']
  }

  return rule?.roundLabels ?? []
}

function getExpectedGroupCount(tournament: TournamentPageConfig, rule: CompetitionRule | null) {
  if (tournament.key === 'argentina-liga-profesional') return 2
  if (tournament.key === 'selecciones-mundial') return 12
  if (CONMEBOL_GROUP_KEYS.has(tournament.key)) return 8
  if (rule?.standingsMode === 'conferences') return 2
  if (rule?.standingsMode === 'groups') return null

  return 0
}

function getExpectedTeamsPerGroup(tournament: TournamentPageConfig) {
  if (tournament.key === 'argentina-liga-profesional') return null
  if (tournament.key === 'selecciones-mundial') return 4
  if (CONMEBOL_GROUP_KEYS.has(tournament.key)) return 4

  return null
}

function getExpectedTeams(tournament: TournamentPageConfig) {
  if (tournament.key === 'argentina-liga-profesional') return 30
  if (tournament.key === 'selecciones-mundial') return 48
  if (CONMEBOL_GROUP_KEYS.has(tournament.key)) return 32

  return UEFA_EXPECTATIONS[tournament.key]?.teams ?? null
}

function getExpectedLeaguePhaseMatchdays(tournament: TournamentPageConfig) {
  return UEFA_EXPECTATIONS[tournament.key]?.leaguePhaseMatchdays ?? null
}

function isGroupName(value: string) {
  const normalized = normalize(value)

  return (
    normalized.includes('group') ||
    normalized.includes('grupo') ||
    normalized.includes('zona') ||
    normalized.includes('conference') ||
    normalized.includes('conferencia')
  )
}

function isGroupFixture(fixture: LeagueFixtureSummary) {
  const normalized = normalize(fixture.round)

  return (
    normalized.includes('group') ||
    normalized.includes('grupo') ||
    normalized.includes('fase de grupos')
  )
}

function getRoundPhase(fixture: LeagueFixtureSummary, tournamentKey: string) {
  const normalized = normalize(fixture.round)

  if (UEFA_COMPETITION_KEYS.has(tournamentKey)) {
    const knockout = auditUefaKnockoutRound(fixture.round)

    if (knockout.normalized) return knockout.normalized
    if (isUefaLeaguePhaseRound(fixture.round)) return 'leaguePhase'
  }

  if (normalized.includes('group') || normalized.includes('grupo')) return 'groups'
  if (normalized.includes('round of 32') || normalized.includes('16th finals')) return 'roundOf32'
  if (normalized.includes('round of 16') || normalized.includes('8th finals') || normalized.includes('octavo')) return 'roundOf16'
  if (normalized.includes('quarter') || normalized.includes('cuarto')) return 'quarterFinals'
  if (normalized.includes('semi')) return 'semiFinals'
  if (normalized.includes('final') && !normalized.includes('semi')) return 'final'
  if (normalized.includes('playoff') || normalized.includes('play off') || normalized.includes('play-off')) return 'playoffs'

  return fixture.round || 'Sin fase'
}

function countByRound(fixtures: LeagueFixtureSummary[], tournamentKey: string) {
  const counts = new Map<string, number>()

  for (const fixture of fixtures) {
    const key = getRoundPhase(fixture, tournamentKey)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([phase, count]) => ({ phase, count }))
    .sort((a, b) => a.phase.localeCompare(b.phase, 'es-AR', { numeric: true }))
}

function getFixtureTeamKeys(fixtures: LeagueFixtureSummary[]) {
  const keys = new Set<string>()

  for (const fixture of fixtures) {
    if (fixture.homeId !== undefined) keys.add(`id:${fixture.homeId}`)
    else if (fixture.home) keys.add(`name:${normalize(fixture.home)}`)

    if (fixture.awayId !== undefined) keys.add(`id:${fixture.awayId}`)
    else if (fixture.away) keys.add(`name:${normalize(fixture.away)}`)
  }

  return keys
}

function getStandingTeamKeys(groups: LeagueStandingGroup[]) {
  const keys = new Set<string>()

  for (const group of groups) {
    for (const row of group.rows) {
      if (row.teamId !== undefined) keys.add(`id:${row.teamId}`)
      else if (row.teamName) keys.add(`name:${normalize(row.teamName)}`)
    }
  }

  return keys
}

function getFoundTeams(fixtures: LeagueFixtureSummary[], standings: LeagueStandingGroup[]) {
  const standingTeams = getStandingTeamKeys(standings)

  if (standingTeams.size) return standingTeams.size

  return getFixtureTeamKeys(fixtures).size
}

function getFoundLeaguePhaseMatchdays(fixtures: LeagueFixtureSummary[]) {
  return [
    ...new Set(
      fixtures
        .filter((fixture) => isUefaLeaguePhaseRound(fixture.round))
        .map((fixture) => getUefaLeaguePhaseRoundNumber(fixture.round))
        .filter((roundNumber): roundNumber is number => Boolean(roundNumber))
    ),
  ].sort((a, b) => a - b)
}

function filterFixturesByDate(
  fixtures: LeagueFixtureSummary[],
  date: string | null | undefined
) {
  if (!date) return fixtures

  return fixtures.filter((fixture) => {
    if (!fixture.date) return false

    return getArgentinaDateISO(fixture.date) === date
  })
}

function buildLeagueLookup(leagues: LeagueRow[]) {
  const latestByExternalId = new Map<string, LeagueRow>()

  for (const league of leagues) {
    if (league.external_id === null || league.external_id === undefined) continue

    const key = String(league.external_id)
    const current = latestByExternalId.get(key)
    const currentSeason = current?.season ?? -1
    const nextSeason = league.season ?? -1

    if (!current || nextSeason >= currentSeason) latestByExternalId.set(key, league)
  }

  return latestByExternalId
}

function getResolvedLeague(
  tournament: TournamentPageConfig,
  latestByExternalId: Map<string, LeagueRow>
) {
  const externalIds = getConfiguredExternalIds(tournament)

  return externalIds
    .map((externalId) => latestByExternalId.get(String(externalId)))
    .find(Boolean) ?? null
}

function detectActualFormat(input: {
  tournament: TournamentPageConfig
  rule: CompetitionRule | null
  fixtures: LeagueFixtureSummary[]
  groups: LeagueStandingGroup[]
}) {
  const { tournament, rule, fixtures, groups } = input
  const hasGroups = groups.some((group) => isGroupName(group.name))
  const hasLeaguePhase =
    UEFA_COMPETITION_KEYS.has(tournament.key) &&
    fixtures.some((fixture) => isUefaLeaguePhaseRound(fixture.round))
  const hasBracket = fixtures.some((fixture) =>
    auditUefaKnockoutRound(fixture.round).includedInBracket ||
    ['roundOf32', 'roundOf16', 'quarterFinals', 'semiFinals', 'final', 'playoffs']
      .includes(getRoundPhase(fixture, tournament.key))
  )

  if (hasLeaguePhase && hasBracket) return 'league_phase_plus_knockout'
  if (hasLeaguePhase) return 'league_phase_only'
  if (hasGroups && hasBracket) return 'groups_plus_knockout'
  if (hasGroups) return 'groups'
  if (hasBracket) return 'knockout_cup'
  if (rule?.standingsMode === 'single' && groups.length) return 'league_table'

  return fixtures.length ? 'fixtures_only' : 'empty'
}

function hasKazakhstanSignal(league: LeagueRow | null, fixtures: LeagueFixtureSummary[]) {
  const leagueText = normalize(`${league?.name ?? ''} ${league?.country ?? ''}`)

  if (leagueText.includes('kazakhstan') || leagueText.includes('kazajistan')) return true

  return fixtures.some((fixture) => {
    const teamText = normalize(`${fixture.home} ${fixture.away}`)

    return KAZAKHSTAN_TEAM_PATTERNS.some((pattern) => teamText.includes(pattern))
  })
}

function getRenderedSections(input: {
  tournament: TournamentPageConfig
  displayOptions: ReturnType<typeof getTournamentDisplayOptions>
  fixtures: LeagueFixtureSummary[]
  standings: LeagueStandingGroup[]
  championsCount: number
}) {
  const sections = ['header']
  const { tournament, displayOptions, fixtures, championsCount } = input
  const hasBracket = fixtures.some((fixture) =>
    auditUefaKnockoutRound(fixture.round).includedInBracket ||
    ['roundOf32', 'roundOf16', 'quarterFinals', 'semiFinals', 'final', 'playoffs']
      .includes(getRoundPhase(fixture, tournament.key))
  )

  if (displayOptions.standingsMode === 'league_phase') sections.push('uefaLeaguePhaseTable')
  if (displayOptions.standingsMode === 'groups') sections.push('groups')
  if (displayOptions.standingsMode === 'single') sections.push('standings')
  if (displayOptions.showBracket || hasBracket) sections.push('bracket')
  if (fixtures.length && displayOptions.standingsMode !== 'league_phase') sections.push('fixturesByRound')
  if (fixtures.length && displayOptions.standingsMode === 'league_phase') sections.push('fixturesByPhase')
  if (displayOptions.showAnnualTable) sections.push('annualTable')
  if (displayOptions.showPromedios) sections.push('promedios')
  if (championsCount) sections.push('champions')
  if (tournament.key === 'argentina-copa-argentina') sections.push('copaArgentinaMatchList')

  return [...new Set(sections)]
}

function buildProblems(input: {
  tournament: TournamentPageConfig
  rule: CompetitionRule | null
  league: LeagueRow | null
  fixtures: LeagueFixtureSummary[]
  standings: LeagueStandingGroup[]
  championsCount: number
  displayOptions: ReturnType<typeof getTournamentDisplayOptions>
}) {
  const warnings: string[] = []
  const criticalErrors: string[] = []
  const mappingErrors: string[] = []
  const {
    tournament,
    rule,
    league,
    fixtures,
    standings,
    championsCount,
    displayOptions,
  } = input
  const configuredExternalIds = getConfiguredExternalIds(tournament)
  const resolvedExternalId = league?.external_id === null || league?.external_id === undefined
    ? null
    : Number(league.external_id)
  const groupTables = standings.filter((group) => isGroupName(group.name))
  const expectedGroupCount = getExpectedGroupCount(tournament, rule)
  const expectedTeamsPerGroup = getExpectedTeamsPerGroup(tournament)
  const phases = new Set(fixtures.map((fixture) => getRoundPhase(fixture, tournament.key)))
  const groupFixtureCount = fixtures.filter(isGroupFixture).length
  const foundTeams = getFoundTeams(fixtures, standings)

  if (tournament.key === 'argentina-liga-profesional') {
    const groupNames = new Set(groupTables.map((group) => normalize(group.name)))
    const hasGrupoA = [...groupNames].some((name) => name.includes('grupo a') || name.includes('group a'))
    const hasGrupoB = [...groupNames].some((name) => name.includes('grupo b') || name.includes('group b'))

    if (displayOptions.standingsMode !== 'groups') {
      criticalErrors.push('Liga Profesional debe tener standingsMode=groups.')
    }
    if (!hasGrupoA || !hasGrupoB || groupTables.length < 2) {
      criticalErrors.push('Liga Profesional no esta separada en Grupo A y Grupo B.')
    }
  }

  if (!league) {
    warnings.push('No hay liga resuelta en Supabase para el external_id configurado.')
  }

  if (
    configuredExternalIds.length &&
    resolvedExternalId !== null &&
    !configuredExternalIds.includes(resolvedExternalId)
  ) {
    mappingErrors.push(`Usa external_id ${resolvedExternalId}, esperado ${configuredExternalIds.join(', ')}.`)
  }

  if (tournament.key === 'selecciones-mundial') {
    if (resolvedExternalId !== 1) mappingErrors.push('Mundial debe usar API-Football league id 1.')
    if (!fixtures.length) criticalErrors.push('Mundial sin datos.')
    if (displayOptions.showAnnualTable || displayOptions.showPromedios) {
      criticalErrors.push('Mundial no debe mostrar tabla anual ni promedios.')
    }
  }

  if (tournament.key === 'internacional-concacaf-champions') {
    if (resolvedExternalId !== 16) mappingErrors.push('Concacaf Champions debe usar API-Football league id 16.')
    if (hasKazakhstanSignal(league, fixtures)) {
      criticalErrors.push('Concacaf Champions esta mostrando datos/equipos de Kazajistan.')
    }
  }

  if (tournament.key === 'internacional-libertadores') {
    if (resolvedExternalId !== 13) mappingErrors.push('Libertadores debe usar API-Football league id 13.')
    if (expectedGroupCount && groupTables.length < expectedGroupCount) {
      criticalErrors.push(`Libertadores tiene ${groupTables.length} grupos detectados; se esperaban ${expectedGroupCount}.`)
    }
    if (groupFixtureCount > 0 && groupFixtureCount < 96) {
      criticalErrors.push(`Libertadores tiene fixture de grupos incompleto (${groupFixtureCount}/96).`)
    }
    if (championsCount < 66) criticalErrors.push('Libertadores no tiene campeones completos desde 1960.')
  }

  if (tournament.key === 'internacional-sudamericana') {
    if (resolvedExternalId !== 11) mappingErrors.push('Sudamericana debe usar API-Football league id 11.')
    if (expectedGroupCount && groupTables.length < expectedGroupCount) {
      criticalErrors.push(`Sudamericana tiene ${groupTables.length} grupos detectados; se esperaban ${expectedGroupCount}.`)
    }
    const incompleteGroups = expectedTeamsPerGroup
      ? groupTables.filter((group) => group.rows.length < expectedTeamsPerGroup)
      : []
    if (incompleteGroups.length) {
      criticalErrors.push(`Sudamericana tiene grupos incompletos: ${incompleteGroups.map((group) => group.name).join(', ')}.`)
    }
    if (championsCount < 24) criticalErrors.push('Sudamericana no tiene campeones completos desde 2002.')
  }

  if (UEFA_COMPETITION_KEYS.has(tournament.key)) {
    const requiredPhases = ['leaguePhase', 'playoffs', 'roundOf16', 'quarterFinals', 'semiFinals', 'final']
    const missingPhases = requiredPhases.filter((phase) => !phases.has(phase))
    const expectation = UEFA_EXPECTATIONS[tournament.key]
    const leaguePhaseMatchdays = getFoundLeaguePhaseMatchdays(fixtures)

    if (phases.size <= 1 && fixtures.length) {
      criticalErrors.push('Competencia UEFA mostrando solo una fase.')
    }
    if (expectation && foundTeams !== expectation.teams) {
      criticalErrors.push(`Competencia UEFA tiene ${foundTeams}/${expectation.teams} equipos en tabla/fase liga.`)
    }
    if (expectation && leaguePhaseMatchdays.length !== expectation.leaguePhaseMatchdays) {
      criticalErrors.push(
        `Competencia UEFA tiene ${leaguePhaseMatchdays.length}/${expectation.leaguePhaseMatchdays} fechas de fase liga.`
      )
    }
    if (expectation && leaguePhaseMatchdays.some((matchday) => matchday > expectation.leaguePhaseMatchdays)) {
      criticalErrors.push('Competencia UEFA incluye fechas de fase liga fuera del formato vigente.')
    }
    if (missingPhases.length) {
      warnings.push(`Faltan fases UEFA detectadas: ${missingPhases.join(', ')}.`)
    }
  }

  if (tournament.key === 'argentina-copa-argentina') {
    if (displayOptions.showAnnualTable || displayOptions.showPromedios) {
      criticalErrors.push('Copa Argentina no debe mostrar tabla anual ni promedios.')
    }
  }

  if (
    rule &&
    rule.standingsMode !== 'single' &&
    rule.standingsMode !== 'none' &&
    fixtures.length > 0 &&
    phases.size <= 1
  ) {
    warnings.push('La competencia visible parece tener una sola fase cargada.')
  }

  if (
    rule?.standingsMode === 'single' &&
    foundTeams >= 10 &&
    fixtures.length > 0 &&
    fixtures.length < foundTeams * 5
  ) {
    warnings.push('La liga parece tener fixture parcial para una pagina de torneo completo.')
  }

  for (const group of groupTables) {
    if (expectedTeamsPerGroup && group.rows.length < expectedTeamsPerGroup) {
      warnings.push(`${group.name} tiene ${group.rows.length}/${expectedTeamsPerGroup} equipos.`)
    }
  }

  return { warnings, criticalErrors, mappingErrors }
}

function filterTournaments(options: CompetitionAuditOptions) {
  const normalizedCompetition = normalize(options.competition)
  const normalizedExternalId = options.leagueExternalId?.trim()

  return VISIBLE_TOURNAMENT_PAGE_CONFIGS.filter((tournament) => {
    const configuredExternalIds = getConfiguredExternalIds(tournament).map(String)

    if (normalizedExternalId && !configuredExternalIds.includes(normalizedExternalId)) {
      return false
    }

    if (!normalizedCompetition) return true

    const values = [
      tournament.key,
      tournament.title,
      ...tournament.searchTerms,
    ].map(normalize)

    return values.some(
      (value) =>
        value === normalizedCompetition ||
        value.includes(normalizedCompetition) ||
        normalizedCompetition.includes(value)
    )
  })
}

export async function getCompetitionDataAudit(options: CompetitionAuditOptions = {}) {
  const supabase = getSupabaseAdminClient()
  const { data: leaguesData, error: leaguesError } = await supabase
    .from('leagues')
    .select('id, external_id, name, country, season')
    .limit(3000)

  if (leaguesError) throw leaguesError

  const leagues = (leaguesData ?? []) as LeagueRow[]
  const latestByExternalId = buildLeagueLookup(leagues)
  const tournaments = filterTournaments(options)
  const competitions = []

  for (const tournament of tournaments) {
    const rule = getCompetitionRule(tournament.key)
    const displayOptions = getTournamentDisplayOptions(tournament)
    const configuredExternalIds = getConfiguredExternalIds(tournament)
    const league = getResolvedLeague(tournament, latestByExternalId)
    const fallbackLeagueExternalId = configuredExternalIds[0] ?? null
    const rawLeagueExternalId = league?.external_id ?? fallbackLeagueExternalId
    const leagueExternalId =
      rawLeagueExternalId === null || rawLeagueExternalId === undefined
        ? null
        : Number(rawLeagueExternalId)
    const season = league?.season ?? null
    let fixtures: LeagueFixtureSummary[] = []
    let standings: LeagueStandingGroup[] = []

    if (leagueExternalId !== null && Number.isFinite(leagueExternalId)) {
      const targetSeason = season ?? new Date().getUTCFullYear()
      const [fixturesResult, standingsResult] = await Promise.allSettled([
        getLeagueFixtures(leagueExternalId, targetSeason),
        getLeagueStandings(leagueExternalId, targetSeason),
      ])

      if (fixturesResult.status === 'fulfilled') {
        fixtures = filterFixturesByDate(fixturesResult.value, options.date)
      }

      if (standingsResult.status === 'fulfilled') {
        standings = standingsResult.value
      }
    }

    const champions = await getTournamentChampions(tournament.key)
    const groupsDetected = standings.filter((group) => isGroupName(group.name))
    const renderedSections = getRenderedSections({
      tournament,
      displayOptions,
      fixtures,
      standings,
      championsCount: champions.length,
    })
    const expectedFormat = getExpectedFormat(tournament, rule)
    const actualFormat = detectActualFormat({ tournament, rule, fixtures, groups: standings })
    const expectedRounds = getExpectedRounds(tournament, rule)
    const expectedTeams = getExpectedTeams(tournament)
    const foundTeams = getFoundTeams(fixtures, standings)
    const expectedLeaguePhaseMatchdays = getExpectedLeaguePhaseMatchdays(tournament)
    const foundLeaguePhaseMatchdays = expectedLeaguePhaseMatchdays !== null
      ? getFoundLeaguePhaseMatchdays(fixtures)
      : null
    const problems = buildProblems({
      tournament,
      rule,
      league,
      fixtures,
      standings,
      championsCount: champions.length,
      displayOptions,
    })
    const missingSections = []

    if (displayOptions.standingsMode !== 'none' && !standings.length) missingSections.push('standings')
    if (displayOptions.showBracket && !renderedSections.includes('bracket')) missingSections.push('bracket')
    if (displayOptions.standingsMode === 'groups' && !groupsDetected.length) missingSections.push('groups')
    if (displayOptions.standingsMode === 'league_phase' && !renderedSections.includes('uefaLeaguePhaseTable')) {
      missingSections.push('uefaLeaguePhaseTable')
    }

    competitions.push({
      name: displayOptions.visibleNameEs,
      visibleName: displayOptions.visibleNameEs,
      expectedCompetition: {
        key: tournament.key,
        title: tournament.title,
        externalIds: configuredExternalIds,
        format: expectedFormat,
      },
      expectedFormat,
      actualFormat,
      route: `/liga/${tournament.key}`,
      external_id: league?.external_id ?? fallbackLeagueExternalId,
      leagueExternalId: league?.external_id ?? fallbackLeagueExternalId,
      apiFootballLeagueIdUsed: league?.external_id ?? fallbackLeagueExternalId,
      resolvedSupabaseLeague: league
        ? {
            id: league.id,
            name: league.name,
            country: league.country,
            season: league.season,
            external_id: league.external_id,
          }
        : null,
      resolvedLeague: league?.name ?? null,
      season,
      expectedRounds,
      foundRounds: [...new Set(fixtures.map((fixture) => fixture.round || 'Sin fase'))],
      roundsExpected: expectedRounds,
      roundsFound: [...new Set(fixtures.map((fixture) => fixture.round || 'Sin fase'))],
      roundsDetected: [...new Set(fixtures.map((fixture) => fixture.round || 'Sin fase'))],
      groupsExpected: getExpectedGroupCount(tournament, rule),
      groupsFound: groupsDetected.map((group) => group.name),
      groupsDetected: groupsDetected.map((group) => group.name),
      expectedGroups: getExpectedGroupCount(tournament, rule),
      foundGroups: groupsDetected.map((group) => group.name),
      expectedTeams,
      foundTeams,
      expectedLeaguePhaseMatchdays,
      foundLeaguePhaseMatchdays,
      matchesByPhase: countByRound(fixtures, tournament.key),
      fixturesByPhase: countByRound(fixtures, tournament.key),
      teamsByGroup: groupsDetected.map((group) => ({
        group: group.name,
        teams: group.rows.length,
      })),
      standingsCount: standings.reduce((sum, group) => sum + group.rows.length, 0),
      fixturesCount: fixtures.length,
      hasTable: standings.length > 0,
      hasFixture: fixtures.length > 0,
      hasBracket: renderedSections.includes('bracket'),
      hasCampeonesCargados: champions.length > 0,
      championsLoaded: champions.length,
      renderedSections,
      missingSections,
      warnings: [...(rule?.warnings ?? []), ...problems.warnings],
      erroresDeMapping: problems.mappingErrors,
      mappingErrors: problems.mappingErrors,
      criticalErrors: problems.criticalErrors,
      usingIncorrectLeague:
        problems.mappingErrors.length > 0 ||
        (tournament.key === 'internacional-concacaf-champions' &&
          hasKazakhstanSignal(league, fixtures)),
    })
  }

  return {
    ok: true,
    auditedAt: new Date().toISOString(),
    filters: {
      competition: options.competition ?? null,
      leagueExternalId: options.leagueExternalId ?? null,
      date: options.date ?? null,
    },
    competitions,
    summary: {
      total: competitions.length,
      warnings: competitions.reduce((sum, competition) => sum + competition.warnings.length, 0),
      mappingErrors: competitions.reduce((sum, competition) => sum + competition.mappingErrors.length, 0),
      criticalErrors: competitions.reduce((sum, competition) => sum + competition.criticalErrors.length, 0),
      incomplete: competitions.filter(
        (competition) =>
          competition.warnings.length ||
          competition.mappingErrors.length ||
          competition.criticalErrors.length ||
          competition.missingSections.length
      ).length,
    },
  }
}

export type CompetitionDataAuditResult = Awaited<ReturnType<typeof getCompetitionDataAudit>>
