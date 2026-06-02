import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getCopaArgentinaChampions } from '@/server/copa-argentina/champions'
import { resolveTeamIdentity, normalizeIdentityText } from '@/server/team-identity'
import { fetchAllTeamLogoRows, type TeamLogoLookupRow } from '@/server/team-logo-lookup'
import { getTournamentChampions } from '@/server/tournament-champions'
import { TOURNAMENT_CHAMPION_SEEDS } from '@/server/tournament-champion-seeds'
import { pickLeagueLogoUrl, WORLD_CUP_2026_LOGO_URL } from '@/shared/utils/asset-urls'

type LeagueLogoRow = {
  id: string
  external_id: string | number | null
  name: string | null
  country: string | null
  season: number | null
  logo_url: string | null
}

type TeamLogoIdentityAuditFilters = {
  teamName?: string | null
  leagueExternalId?: string | null
  country?: string | null
  competition?: string | null
  onlyProblems?: boolean
  limit?: number
}

type ChampionsHistoryAuditFilters = {
  competition?: string | null
  season?: string | null
  onlyProblems?: boolean
}

function normalizeCompetitionKey(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  const aliases: Record<string, string> = {
    champions_league: 'internacional-champions',
    uefa_champions_league: 'internacional-champions',
    copa_argentina: 'argentina-copa-argentina',
    libertadores: 'internacional-libertadores',
    sudamericana: 'internacional-sudamericana',
    europa_league: 'internacional-europa-league',
  }

  return aliases[normalized] ?? value
}

function toExternalKey(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized || null
}

function limitRows<T>(rows: T[], limit?: number | null) {
  if (!limit || limit <= 0) return rows
  return rows.slice(0, limit)
}

function groupDuplicatedNames(teams: TeamLogoLookupRow[]) {
  const byName = new Map<string, TeamLogoLookupRow[]>()

  for (const team of teams) {
    const key = normalizeIdentityText(team.name)
    if (!key) continue
    const current = byName.get(key) ?? []
    current.push(team)
    byName.set(key, current)
  }

  return [...byName.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([normalizedName, rows]) => ({
      normalizedName,
      count: rows.length,
      teams: rows.map((team) => ({
        id: team.id,
        externalId: toExternalKey(team.external_id),
        name: team.name,
        logoUrl: team.logo_url,
      })),
    }))
}

async function getWorldCupLogoStatus() {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('leagues')
    .select('id, external_id, name, country, season, logo_url')
    .eq('external_id', '1')
    .order('season', { ascending: false })
    .limit(1)

  if (error) throw error

  const league = ((data ?? []) as LeagueLogoRow[])[0] ?? null
  const resolvedLogo = pickLeagueLogoUrl(league?.logo_url, league?.external_id)

  return {
    leagueFound: Boolean(league),
    leagueExternalId: toExternalKey(league?.external_id),
    leagueName: league?.name ?? null,
    season: league?.season ?? null,
    storedLogoUrl: league?.logo_url ?? null,
    resolvedLogoUrl: resolvedLogo,
    fallbackLocal: WORLD_CUP_2026_LOGO_URL,
    ok: Boolean(resolvedLogo),
  }
}

async function resolveAuditCase(
  name: string,
  context: string,
  expectedExternalId: string,
  leagueExternalId?: string
) {
  const supabase = getSupabaseAdminClient()
  const identity = await resolveTeamIdentity(supabase, {
    name,
    context,
    leagueExternalId,
  })

  return {
    name,
    context,
    expectedExternalId,
    resolvedExternalId: identity.externalId,
    resolvedName: identity.name,
    logoUrl: identity.logoUrl,
    ok: identity.externalId === expectedExternalId,
    warnings: identity.warnings,
  }
}

export async function auditTeamLogoIdentity(filters: TeamLogoIdentityAuditFilters = {}) {
  const supabase = getSupabaseAdminClient()
  const teams = await fetchAllTeamLogoRows(supabase)
  const filteredTeams = filters.teamName
    ? teams.filter((team) => normalizeIdentityText(team.name).includes(normalizeIdentityText(filters.teamName)))
    : teams
  const duplicatedNames = groupDuplicatedNames(filteredTeams)
  const requiredCases = await Promise.all([
    resolveAuditCase('Central Cordoba', 'argentina-copa-argentina', '1065', '130'),
    resolveAuditCase('Central Cordoba (SdE)', 'argentina-copa-argentina', '1065', '130'),
    resolveAuditCase('Arsenal', 'argentina-copa-argentina', '459', '130'),
    resolveAuditCase('Arsenal', 'internacional-sudamericana', '459', '11'),
    resolveAuditCase('Arsenal', 'internacional-champions', '42', '2'),
    resolveAuditCase('Inter', 'internacional-champions', '505', '2'),
  ])
  const missingLogos = filteredTeams
    .filter((team) => !team.logo_url)
    .map((team) => ({
      id: team.id,
      externalId: toExternalKey(team.external_id),
      name: team.name,
    }))
  const worldCupLogoStatus = await getWorldCupLogoStatus()
  const wrongLogoCandidates = requiredCases.filter((row) => !row.ok)
  const ambiguousTeams = duplicatedNames.filter((group) =>
    ['arsenal', 'central cordoba', 'inter'].includes(group.normalizedName)
  )
  const onlyProblems = Boolean(filters.onlyProblems)

  return {
    ok: wrongLogoCandidates.length === 0 && Boolean(worldCupLogoStatus.ok),
    duplicatedNames: onlyProblems ? limitRows(duplicatedNames, filters.limit) : limitRows(duplicatedNames, filters.limit ?? 25),
    ambiguousTeams,
    suspiciousChampionTeams: wrongLogoCandidates,
    wrongLogoCandidates,
    missingLogos: limitRows(missingLogos, filters.limit ?? 25),
    worldCupLogoStatus,
    examples: requiredCases,
    filters,
  }
}

export async function auditChampionsHistory(filters: ChampionsHistoryAuditFilters = {}) {
  const requestedCompetition = normalizeCompetitionKey(filters.competition)
  const competitionKeys = [
    ...Object.keys(TOURNAMENT_CHAMPION_SEEDS),
    'argentina-copa-argentina',
  ].filter((key) =>
    requestedCompetition ? key === requestedCompetition : true
  )
  const missingRecentChampions: Array<{ competition: string; expectedSeason: string; expectedChampion: string }> = []
  const duplicateSeasons: Array<{ competition: string; season: string; count: number }> = []
  const unresolvedChampionTeams: Array<{ competition: string; season: string; teamName: string; role: string }> = []
  const wrongLogoCandidates: Array<Record<string, unknown>> = []
  const examples: Array<Record<string, unknown>> = []

  for (const competition of competitionKeys) {
    const champions =
      competition === 'argentina-copa-argentina'
        ? (await getCopaArgentinaChampions()).map((champion) => ({
            season: String(champion.season),
            championName: champion.championName,
            runnerUpName: champion.runnerUpName,
            finalScore: champion.finalScore,
            championLogo: champion.championLogo,
            runnerUpLogo: champion.runnerUpLogo,
          }))
        : await getTournamentChampions(competition)
    const filteredChampions = champions.filter((champion) =>
      filters.season ? champion.season === filters.season : true
    )
    const bySeason = new Map<string, number>()

    for (const champion of filteredChampions) {
      bySeason.set(champion.season, (bySeason.get(champion.season) ?? 0) + 1)
      if (!champion.championLogo) {
        unresolvedChampionTeams.push({
          competition,
          season: champion.season,
          teamName: champion.championName,
          role: 'champion',
        })
      }

      if (!champion.runnerUpLogo) {
        unresolvedChampionTeams.push({
          competition,
          season: champion.season,
          teamName: champion.runnerUpName,
          role: 'runner_up',
        })
      }
    }

    for (const [season, count] of bySeason.entries()) {
      if (count > 1) duplicateSeasons.push({ competition, season, count })
    }

    if (
      competition === 'internacional-champions' &&
      (!filters.season || filters.season === '2025/26') &&
      !filteredChampions.some((champion) => champion.season === '2025/26' && normalizeIdentityText(champion.championName).includes('paris'))
    ) {
      missingRecentChampions.push({
        competition,
        expectedSeason: '2025/26',
        expectedChampion: 'Paris Saint Germain',
      })
    }

    examples.push({
      competition,
      latest: filteredChampions.slice(0, 3).map((champion) => ({
        season: champion.season,
        championName: champion.championName,
        runnerUpName: champion.runnerUpName,
        finalScore: champion.finalScore,
        championLogo: champion.championLogo,
        runnerUpLogo: champion.runnerUpLogo,
      })),
    })
  }

  const onlyProblems = Boolean(filters.onlyProblems)

  return {
    ok: missingRecentChampions.length === 0 && duplicateSeasons.length === 0 && unresolvedChampionTeams.length === 0,
    competitionsChecked: competitionKeys,
    missingRecentChampions,
    duplicateSeasons,
    unresolvedChampionTeams: onlyProblems ? unresolvedChampionTeams : unresolvedChampionTeams.slice(0, 50),
    wrongLogoCandidates,
    examples,
  }
}

export async function auditChampionLogoCleanup() {
  const identityAudit = await auditTeamLogoIdentity({ onlyProblems: true, limit: 50 })
  const historyAudit = await auditChampionsHistory({ onlyProblems: true })

  return {
    ok: identityAudit.ok && historyAudit.ok,
    dryRunOnly: true,
    suspiciousChampionTeams: identityAudit.suspiciousChampionTeams,
    wrongLogoCandidates: identityAudit.wrongLogoCandidates,
    unresolvedChampionTeams: historyAudit.unresolvedChampionTeams,
    centralCordobaStatus: identityAudit.examples.find(
      (example) => example.name === 'Central Cordoba' && example.context === 'argentina-copa-argentina'
    ),
    arsenalStatus: identityAudit.examples.filter((example) => example.name === 'Arsenal'),
    warnings:
      identityAudit.ok && historyAudit.ok
        ? []
        : ['Ejecutar upsert-tournament-champions o aplicar team_identity_overrides para corregir los casos marcados.'],
  }
}
