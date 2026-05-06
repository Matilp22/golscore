import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  COMPETITION_RULES,
  PROTECTED_COMPETITION_KEYS,
  getCompetitionRule,
} from '@/shared/config/competition-rules'
import { VISIBLE_TOURNAMENT_PAGE_CONFIGS } from '@/shared/config/tournament-pages'
import { getLeagueFinalPhaseKey } from '@/shared/utils/league-rounds'

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

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  return Boolean(cronSecret && request.headers.get('x-cron-secret') === cronSecret)
}

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function getFallbackExternalIds(key: string) {
  return COMPETITION_RULES.find((rule) => rule.key === key)?.externalIds ?? []
}

function matchLeagueToTournament(league: LeagueRow, searchTerms: string[]) {
  const leagueName = normalize(league.name)
  const normalizedTerms = searchTerms.map(normalize)

  return normalizedTerms.some((term) => leagueName === term || leagueName.includes(term))
}

function hasKnockoutRound(rounds: string[]) {
  return rounds.some((round) => {
    const normalized = normalize(round)

    return Boolean(getLeagueFinalPhaseKey(round)) ||
      normalized.includes('round of') ||
      normalized.includes('octavos') ||
      normalized.includes('cuartos') ||
      normalized.includes('semifinal') ||
      normalized.includes('final')
  })
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const visibleTournaments = VISIBLE_TOURNAMENT_PAGE_CONFIGS
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
    const leaguesByExternalId = new Map(
      leagues
        .filter((league) => league.external_id !== null && league.external_id !== undefined)
        .map((league) => [String(league.external_id), league])
    )
    const roundsByLeagueId = rounds.reduce<Map<string, string[]>>((accumulator, match) => {
      if (!match.league_id) return accumulator

      const leagueId = String(match.league_id)
      const current = accumulator.get(leagueId) ?? []

      if (match.round && !current.includes(match.round)) current.push(match.round)
      accumulator.set(leagueId, current)

      return accumulator
    }, new Map())

    const competitions = visibleTournaments.map((tournament) => {
      const rule = getCompetitionRule(tournament.key)
      const fallbackExternalIds = getFallbackExternalIds(tournament.key)
      const league =
        fallbackExternalIds
          .map((externalId) => leaguesByExternalId.get(String(externalId)))
          .find(Boolean) ??
        leagues.find((candidate) =>
          matchLeagueToTournament(candidate, tournament.searchTerms)
        ) ??
        null
      const detectedRounds = league ? roundsByLeagueId.get(String(league.id)) ?? [] : []
      const protectedCompetition = PROTECTED_COMPETITION_KEYS.has(tournament.key)
      const warnings: string[] = []

      if (!rule && !protectedCompetition) warnings.push('Sin regla centralizada.')
      if (!league) warnings.push('No se encontro liga en Supabase para esta competencia visible.')
      if (league && !detectedRounds.length) warnings.push('Sin rounds detectados en matches.')

      return {
        key: tournament.key,
        name: tournament.title,
        external_id: league?.external_id ?? fallbackExternalIds[0] ?? null,
        supabase_league_id: league?.id ?? null,
        country: league?.country ?? tournament.country ?? null,
        protected: protectedCompetition,
        type_detected: protectedCompetition ? 'protected' : rule?.type ?? 'unknown',
        standings_mode: protectedCompetition ? 'unchanged' : rule?.standingsMode ?? 'unknown',
        rounds_detected: detectedRounds,
        has_groups:
          protectedCompetition
            ? null
            : rule?.standingsMode === 'groups' ||
              detectedRounds.some((round) => normalize(round).includes('group')),
        has_bracket:
          protectedCompetition
            ? null
            : Boolean(rule?.showBracket || hasKnockoutRound(detectedRounds)),
        rules_applied: protectedCompetition
          ? ['Protegida: sin cambios automaticos desde esta auditoria.']
          : [
              ...(rule?.qualificationRules ?? []),
              ...(rule?.relegationRules ?? []),
              ...(rule?.roundLabelRules ?? []),
            ],
        warnings,
      }
    })

    return jsonNoStore(
      {
        ok: true,
        competitions,
        summary: {
          visible_competitions: competitions.length,
          protected_competitions: competitions.filter((competition) => competition.protected).length,
          with_rules: competitions.filter(
            (competition) => competition.protected || competition.type_detected !== 'unknown'
          ).length,
          warnings: competitions.reduce((sum, competition) => sum + competition.warnings.length, 0),
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error('[competitions-audit] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar competencias.',
      },
      { status: 500 }
    )
  }
}
