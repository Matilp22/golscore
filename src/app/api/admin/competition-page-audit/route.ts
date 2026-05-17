import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getCompetitionRule,
  getTournamentDisplayOptions,
} from '@/shared/config/competition-rules'
import { VISIBLE_TOURNAMENT_PAGE_CONFIGS } from '@/shared/config/tournament-pages'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type LeagueRow = {
  id: string | number
  external_id: string | number | null
  name: string | null
  country: string | null
  season: number | null
}

type MatchRoundRow = {
  league_id: string | number | null
  round: string | null
}

const PROTECTED_EXTERNAL_IDS: Record<string, number[]> = {
  'argentina-liga-profesional': [128],
  'argentina-copa-argentina': [130],
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

function getAuthorizationToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i)

  return bearerMatch?.[1] ?? request.headers.get('x-cron-secret')
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET

  return Boolean(cronSecret && getAuthorizationToken(request) === cronSecret)
}

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function getConfiguredExternalIds(tournamentKey: string) {
  return getCompetitionRule(tournamentKey)?.externalIds ?? PROTECTED_EXTERNAL_IDS[tournamentKey] ?? []
}

function buildLatestLeagueByExternalId(leagues: LeagueRow[]) {
  const latestByExternalId = new Map<string, LeagueRow>()

  for (const league of leagues) {
    if (league.external_id === null || league.external_id === undefined) continue

    const key = String(league.external_id)
    const current = latestByExternalId.get(key)
    const currentSeason = current?.season ?? -1
    const nextSeason = league.season ?? -1

    if (!current || nextSeason >= currentSeason) {
      latestByExternalId.set(key, league)
    }
  }

  return latestByExternalId
}

function matchLeagueBySearchTerms(leagues: LeagueRow[], searchTerms: string[]) {
  const normalizedTerms = searchTerms.map(normalize).filter(Boolean)

  return leagues.find((league) => {
    const leagueName = normalize(league.name)

    return normalizedTerms.some(
      (term) => leagueName === term || leagueName.includes(term) || term.includes(leagueName)
    )
  }) ?? null
}

function getLayoutMode(displayOptions: ReturnType<typeof getTournamentDisplayOptions>) {
  if (displayOptions.standingsMode === 'league_phase') return 'league_phase_plus_knockout'
  if (displayOptions.standingsMode === 'groups' && displayOptions.showBracket) {
    return 'groups_plus_knockout'
  }
  if (displayOptions.standingsMode === 'groups') return 'groups'
  if (displayOptions.standingsMode === 'zones') return 'zones'
  if (displayOptions.standingsMode === 'conferences') return 'conferences'
  if (displayOptions.standingsMode === 'single') return 'league_table'
  if (displayOptions.showBracket) return 'knockout'

  return 'no_standings'
}

function hasKnockoutRound(rounds: string[]) {
  return rounds.some((round) => {
    const normalized = normalize(round)

    return (
      normalized.includes('round of') ||
      normalized.includes('octavos') ||
      normalized.includes('cuartos') ||
      normalized.includes('quarter') ||
      normalized.includes('semi') ||
      normalized.includes('final') ||
      normalized.includes('playoff') ||
      normalized.includes('play-off')
    )
  })
}

function hasGroupRound(rounds: string[]) {
  return rounds.some((round) => {
    const normalized = normalize(round)

    return (
      normalized.includes('group') ||
      normalized.includes('grupo') ||
      normalized.includes('zona') ||
      normalized.includes('conference') ||
      normalized.includes('conferencia') ||
      normalized.includes('league phase') ||
      normalized.includes('fase liga')
    )
  })
}

function getHiddenSections(displayOptions: ReturnType<typeof getTournamentDisplayOptions>) {
  const hiddenSections: string[] = []

  if (displayOptions.standingsMode === 'none') hiddenSections.push('standings')
  if (!displayOptions.showAnnualTable) hiddenSections.push('annualTable')
  if (!displayOptions.showPromedios) hiddenSections.push('averagesTable')
  if (!displayOptions.hasRelegation) hiddenSections.push('relegation')
  if (displayOptions.groupMode === 'none') hiddenSections.push('groups')
  if (!displayOptions.showBracket) hiddenSections.push('bracket')
  if (displayOptions.standingsMode !== 'league_phase') hiddenSections.push('uefaLeaguePhase')

  return hiddenSections
}

function getRenderedSections(
  tournamentKey: string,
  displayOptions: ReturnType<typeof getTournamentDisplayOptions>,
  rounds: string[]
) {
  const renderedSections = ['header']
  const hasRounds = rounds.length > 0

  if (displayOptions.standingsMode === 'league_phase') renderedSections.push('uefaLeaguePhase')
  if (displayOptions.standingsMode === 'groups') renderedSections.push('groups')
  if (
    displayOptions.standingsMode === 'single' ||
    displayOptions.standingsMode === 'zones' ||
    displayOptions.standingsMode === 'conferences'
  ) {
    renderedSections.push('standings')
  }
  if (displayOptions.showBracket) renderedSections.push('bracket')
  if (displayOptions.showAnnualTable) renderedSections.push('annualTable')
  if (displayOptions.showPromedios) renderedSections.push('averagesTable')
  if (hasRounds && displayOptions.standingsMode !== 'league_phase') renderedSections.push('roundFixtures')
  if (tournamentKey === 'argentina-copa-argentina') renderedSections.push('copaArgentinaMatchList')

  return renderedSections
}

function getWarnings(input: {
  key: string
  league: LeagueRow | null
  displayOptions: ReturnType<typeof getTournamentDisplayOptions>
  rounds: string[]
}) {
  const warnings: string[] = []
  const { key, league, displayOptions, rounds } = input
  const externalId = league?.external_id === null || league?.external_id === undefined
    ? null
    : String(league.external_id)
  const realName = normalize(league?.name)

  if (!league) warnings.push('No se encontro liga en Supabase para esta ruta.')

  if (key === 'argentina-copa-argentina') {
    if (displayOptions.standingsMode !== 'none') warnings.push('Copa Argentina no debe renderizar standings.')
    if (displayOptions.showAnnualTable) warnings.push('Copa Argentina no debe mostrar tabla anual.')
    if (displayOptions.showPromedios) warnings.push('Copa Argentina no debe mostrar promedios.')
  }

  if (key === 'selecciones-mundial') {
    if (externalId !== '1') warnings.push('Mundial debe resolver external_id 1.')
    if (realName.includes('qualification')) warnings.push('Mundial esta apuntando a una eliminatoria.')
    if (realName && !realName.includes('world cup')) warnings.push('El nombre real no parece Mundial.')
  }

  if (key === 'internacional-libertadores') {
    if (externalId !== '13') warnings.push('Libertadores debe resolver external_id 13.')
    if (displayOptions.standingsMode !== 'groups') warnings.push('Libertadores debe usar grupos.')
    if (displayOptions.standingsMode === 'league_phase') warnings.push('Libertadores no debe usar fase liga UEFA.')
  }

  if (key === 'internacional-sudamericana') {
    if (externalId !== '11') warnings.push('Sudamericana debe resolver external_id 11.')
    if (displayOptions.standingsMode !== 'groups') warnings.push('Sudamericana debe usar grupos.')
  }

  if (
    (key === 'internacional-champions' || key === 'internacional-europa-league') &&
    displayOptions.standingsMode !== 'league_phase'
  ) {
    warnings.push('Competencia UEFA debe conservar formato league phase.')
  }

  if (displayOptions.standingsMode === 'none' && hasGroupRound(rounds)) {
    warnings.push('Hay rounds de grupos, pero la regla oculta standings.')
  }

  return warnings
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const [{ data: leaguesData, error: leaguesError }, { data: roundsData, error: roundsError }] =
      await Promise.all([
        supabase
          .from('leagues')
          .select('id, external_id, name, country, season')
          .limit(2000),
        supabase
          .from('matches')
          .select('league_id, round')
          .limit(10000),
      ])

    if (leaguesError) throw leaguesError
    if (roundsError) throw roundsError

    const leagues = (leaguesData ?? []) as LeagueRow[]
    const rounds = (roundsData ?? []) as MatchRoundRow[]
    const latestByExternalId = buildLatestLeagueByExternalId(leagues)
    const roundsByLeagueId = rounds.reduce<Map<string, string[]>>((accumulator, match) => {
      if (!match.league_id || !match.round) return accumulator

      const key = String(match.league_id)
      const current = accumulator.get(key) ?? []

      if (!current.includes(match.round)) current.push(match.round)
      accumulator.set(key, current)

      return accumulator
    }, new Map())

    const competitions = VISIBLE_TOURNAMENT_PAGE_CONFIGS.map((tournament) => {
      const displayOptions = getTournamentDisplayOptions(tournament)
      const rule = getCompetitionRule(tournament.key)
      const configuredExternalIds = getConfiguredExternalIds(tournament.key)
      const league =
        configuredExternalIds
          .map((externalId) => latestByExternalId.get(String(externalId)))
          .find(Boolean) ??
        matchLeagueBySearchTerms(leagues, tournament.searchTerms)
      const detectedRounds = league ? roundsByLeagueId.get(String(league.id)) ?? [] : []
      const layoutMode = getLayoutMode(displayOptions)
      const hiddenSections = getHiddenSections(displayOptions)
      const renderedSections = getRenderedSections(tournament.key, displayOptions, detectedRounds)
      const warnings = [
        ...(rule?.warnings ?? []),
        ...getWarnings({
          key: tournament.key,
          league: league ?? null,
          displayOptions,
          rounds: detectedRounds,
        }),
      ]

      return {
        visibleName: displayOptions.visibleNameEs,
        route: `/liga/${tournament.key}`,
        slug: tournament.key,
        external_id: league?.external_id ?? configuredExternalIds[0] ?? null,
        configuredExternalIds,
        supabase_league_id: league?.id ?? null,
        realLeagueName: league?.name ?? null,
        country: league?.country ?? tournament.country ?? null,
        season: league?.season ?? null,
        type: rule?.type ?? (displayOptions.protected ? 'protected' : 'unknown'),
        layoutMode,
        standingsMode: displayOptions.standingsMode,
        hasAnnualTable: displayOptions.showAnnualTable,
        hasAveragesTable: displayOptions.showPromedios,
        hasRelegation: displayOptions.hasRelegation,
        hasGroups: displayOptions.groupMode !== 'none',
        hasBracket: displayOptions.showBracket,
        hasLeaguePhase: displayOptions.standingsMode === 'league_phase',
        hasPlayoffs: displayOptions.showBracket || hasKnockoutRound(detectedRounds),
        qualificationRules: rule?.qualificationRules ?? [],
        relegationRules: rule?.relegationRules ?? [],
        groupRules: displayOptions.groupMode,
        bracketRules: displayOptions.bracketMode,
        roundLabels: rule?.roundLabels ?? [],
        hiddenSections,
        renderedSections,
        roundsDetected: detectedRounds,
        groupsDetected: hasGroupRound(detectedRounds),
        bracketDetected: hasKnockoutRound(detectedRounds),
        warnings,
      }
    })

    return jsonNoStore({
      ok: true,
      competitions,
      summary: {
        total: competitions.length,
        warnings: competitions.reduce((total, competition) => total + competition.warnings.length, 0),
        withWarnings: competitions.filter((competition) => competition.warnings.length > 0).length,
      },
    })
  } catch (error) {
    console.error('[competition-page-audit] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar paginas de competencias.',
      },
      { status: 500 }
    )
  }
}
