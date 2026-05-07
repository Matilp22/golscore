import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  COMPETITION_RULES,
  GENERAL_COMPETITION_REFERENCE_SOURCES,
  PROTECTED_COMPETITION_KEYS,
  PROTECTED_COMPETITION_REASON,
  getCompetitionCountryNameEs,
  getCompetitionLegendItems,
  getCompetitionRule,
  getCompetitionVisibleNameEs,
  getProtectedCompetitionAudit,
} from '@/lib/competition-rules'
import { VISIBLE_TOURNAMENT_PAGE_CONFIGS } from '@/shared/config/tournament-pages'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type LeagueRow = {
  id: string | number
  external_id: string | number | null
  name: string | null
  country: string | null
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

function getFallbackExternalIds(key: string) {
  return COMPETITION_RULES.find((rule) => rule.key === key)?.externalIds ?? []
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('leagues')
      .select('id, external_id, name, country')
      .limit(2000)

    if (error) throw error

    const leagues = (data ?? []) as LeagueRow[]
    const leaguesByExternalId = new Map(
      leagues
        .filter((league) => league.external_id !== null && league.external_id !== undefined)
        .map((league) => [String(league.external_id), league])
    )

    const competitions = VISIBLE_TOURNAMENT_PAGE_CONFIGS.map((tournament) => {
      const rule = getCompetitionRule(tournament.key)
      const protectedCompetition = PROTECTED_COMPETITION_KEYS.has(tournament.key)
      const protectedAudit = getProtectedCompetitionAudit(tournament.key)
      const fallbackExternalIds = getFallbackExternalIds(tournament.key)
      const league =
        fallbackExternalIds
          .map((externalId) => leaguesByExternalId.get(String(externalId)))
          .find(Boolean) ?? null
      const source = protectedCompetition
        ? ['skipped']
        : Array.from(new Set([
            ...GENERAL_COMPETITION_REFERENCE_SOURCES,
            ...(rule?.sourceUsed ?? ['Supabase leagues']),
          ]))
      const warnings = protectedCompetition
        ? [PROTECTED_COMPETITION_REASON]
        : [
            ...(!rule ? ['Sin regla centralizada.'] : []),
            ...(rule?.warnings ?? []),
          ]

      return {
        key: tournament.key,
        name:
          protectedAudit?.visibleNameEs ??
          getCompetitionVisibleNameEs(tournament.key, tournament.title),
        originalName: league?.name ?? tournament.title,
        countryNameEs:
          protectedAudit?.countryNameEs ??
          getCompetitionCountryNameEs(
            tournament.key,
            league?.country ?? tournament.country ?? null
          ),
        external_id: league?.external_id ?? fallbackExternalIds[0] ?? null,
        skipped: protectedCompetition,
        configured: Boolean(rule) || protectedCompetition,
        reason: protectedCompetition ? PROTECTED_COMPETITION_REASON : null,
        source,
        sourceUsed: source,
        qualificationRules: protectedCompetition ? [] : rule?.qualificationRules ?? [],
        classificationZones: protectedCompetition ? [] : rule?.qualificationRules ?? [],
        relegationRules: protectedCompetition ? [] : rule?.relegationRules ?? [],
        relegationZones: protectedCompetition ? [] : rule?.relegationRules ?? [],
        playoffRules: protectedCompetition ? [] : rule?.playoffRules ?? [],
        legendItems: protectedCompetition ? [] : getCompetitionLegendItems(rule),
        hasAverages: protectedCompetition ? null : rule?.hasAverages ?? false,
        hasRelegation: protectedCompetition ? null : rule?.hasRelegation ?? false,
        relegationMode: protectedCompetition ? 'unchanged' : rule?.relegationMode ?? 'unknown',
        warnings,
      }
    })

    return jsonNoStore({
      ok: true,
      competitions,
      summary: {
        visible_competitions: competitions.length,
        skipped_competitions: competitions.filter((competition) => competition.skipped).length,
        with_rules: competitions.filter(
          (competition) => competition.configured
        ).length,
        warnings: competitions.reduce((sum, competition) => sum + competition.warnings.length, 0),
      },
    })
  } catch (error) {
    console.error('[competition-rules-audit] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar reglas de competencias.',
      },
      { status: 500 }
    )
  }
}
