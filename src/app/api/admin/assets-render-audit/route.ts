import { NextResponse } from 'next/server'

import {
  getHomeMatchesSourceSnapshot,
  getMatchDetail,
  getTeamDetail,
} from '@/lib/api-football'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getArgentinaTodayISO } from '@/shared/utils/argentina-time'
import {
  TOURNAMENT_LEAGUE_EXTERNAL_IDS,
  pickLeagueLogoUrl,
  pickStableAssetUrl,
  pickTeamLogoUrl,
} from '@/shared/utils/asset-urls'

export const dynamic = 'force-dynamic'

type TeamAssetRow = {
  id: string | number
  external_id: string | number | null
  name: string | null
  logo_url: string | null
}

type LeagueAssetRow = {
  id: string | number
  external_id: string | number | null
  name: string | null
  country: string | null
  season: number | null
  logo_url: string | null
}

type PlayerAssetRow = {
  id: string | number
  external_id: string | number | null
  name: string | null
  team_id: string | number | null
  team_external_id: string | number | null
  photo_url: string | null
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

function toExternalKey(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized || null
}

function uniqueValues(values: Array<string | number | null | undefined>) {
  return [...new Set(values.map(toExternalKey).filter(Boolean))] as string[]
}

async function fetchTeamsByExternalIds(externalIds: string[]) {
  const supabase = getSupabaseAdminClient()
  const teams = new Map<string, TeamAssetRow>()

  for (let index = 0; index < externalIds.length; index += 100) {
    const chunk = externalIds.slice(index, index + 100)
    const { data, error } = await supabase
      .from('teams')
      .select('id, external_id, name, logo_url')
      .in('external_id', chunk)

    if (error) throw error

    for (const row of (data ?? []) as TeamAssetRow[]) {
      const key = toExternalKey(row.external_id)
      if (key) teams.set(key, row)
    }
  }

  return teams
}

async function fetchLeaguesByExternalIds(externalIds: string[]) {
  const supabase = getSupabaseAdminClient()
  const leagues = new Map<string, LeagueAssetRow>()

  for (let index = 0; index < externalIds.length; index += 100) {
    const chunk = externalIds.slice(index, index + 100)
    const { data, error } = await supabase
      .from('leagues')
      .select('id, external_id, name, country, season, logo_url')
      .in('external_id', chunk)
      .order('season', { ascending: false })

    if (error) throw error

    for (const row of (data ?? []) as LeagueAssetRow[]) {
      const key = toExternalKey(row.external_id)
      if (key && !leagues.has(key)) leagues.set(key, row)
    }
  }

  return leagues
}

async function fetchPlayersForTeam(team: TeamAssetRow | null | undefined) {
  if (!team) return []

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('players')
    .select('id, external_id, name, team_id, team_external_id, photo_url')
    .or(`team_id.eq.${team.id},team_external_id.eq.${team.external_id}`)
    .limit(50)

  if (error) return []

  return (data ?? []) as PlayerAssetRow[]
}

function addMissing(
  missingInRender: Array<Record<string, unknown>>,
  issue: Record<string, unknown>
) {
  missingInRender.push(issue)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || getArgentinaTodayISO()
    const fixtureParam = Number(searchParams.get('fixture') || searchParams.get('matchId'))
    const teamExternalParam = searchParams.get('teamExternalId')
    const homeSnapshot = await getHomeMatchesSourceSnapshot(date)
    const homeMatches = homeSnapshot.mergedMatches.slice(0, 12)
    const homeTeamExternalIds = uniqueValues(
      homeMatches.flatMap((match) => [match.homeId, match.awayId])
    )
    const homeLeagueExternalIds = uniqueValues(homeMatches.map((match) => match.leagueId))
    const [homeTeamsByExternalId, homeLeaguesByExternalId] = await Promise.all([
      fetchTeamsByExternalIds(homeTeamExternalIds),
      fetchLeaguesByExternalIds(homeLeagueExternalIds),
    ])
    const missingInRender: Array<Record<string, unknown>> = []
    const warnings: string[] = []
    const homeSamples = homeMatches.map((match) => {
      const homeKey = toExternalKey(match.homeId)
      const awayKey = toExternalKey(match.awayId)
      const leagueKey = toExternalKey(match.leagueId)
      const homeTeam = homeKey ? homeTeamsByExternalId.get(homeKey) : null
      const awayTeam = awayKey ? homeTeamsByExternalId.get(awayKey) : null
      const league = leagueKey ? homeLeaguesByExternalId.get(leagueKey) : null
      const expectedHomeLogoUrl = pickTeamLogoUrl(homeTeam?.logo_url, match.homeId) ?? null
      const expectedAwayLogoUrl = pickTeamLogoUrl(awayTeam?.logo_url, match.awayId) ?? null
      const expectedLeagueLogoUrl = pickLeagueLogoUrl(league?.logo_url, match.leagueId) ?? null

      if (expectedHomeLogoUrl && !match.homeLogo) {
        addMissing(missingInRender, {
          surface: 'home',
          field: 'homeLogo',
          fixture: match.externalId,
          team: match.home,
          teamExternalId: match.homeId ?? null,
          expectedLogoUrl: expectedHomeLogoUrl,
        })
      }

      if (expectedAwayLogoUrl && !match.awayLogo) {
        addMissing(missingInRender, {
          surface: 'home',
          field: 'awayLogo',
          fixture: match.externalId,
          team: match.away,
          teamExternalId: match.awayId ?? null,
          expectedLogoUrl: expectedAwayLogoUrl,
        })
      }

      if (expectedLeagueLogoUrl && !match.leagueLogo) {
        addMissing(missingInRender, {
          surface: 'home',
          field: 'leagueLogo',
          fixture: match.externalId,
          league: match.league,
          leagueExternalId: match.leagueId ?? null,
          expectedLogoUrl: expectedLeagueLogoUrl,
        })
      }

      return {
        fixture: match.externalId,
        league: match.league,
        leagueExternalId: match.leagueId ?? null,
        leagueLogoUrl: match.leagueLogo ?? null,
        expectedLeagueLogoUrl,
        home: match.home,
        homeExternalId: match.homeId ?? null,
        homeLogoUrl: match.homeLogo ?? null,
        expectedHomeLogoUrl,
        away: match.away,
        awayExternalId: match.awayId ?? null,
        awayLogoUrl: match.awayLogo ?? null,
        expectedAwayLogoUrl,
      }
    })
    const sampleFixtureId =
      Number.isFinite(fixtureParam) && fixtureParam > 0
        ? fixtureParam
        : homeMatches.find((match) => match.externalId)?.externalId
    const matchDetailSamples = []

    if (sampleFixtureId) {
      const detail = await getMatchDetail(Number(sampleFixtureId))
      const fixture = detail.fixture

      if (fixture) {
        const homeLogoUrl =
          fixture.teams.home.logo_url ?? fixture.teams.home.logo ?? null
        const awayLogoUrl =
          fixture.teams.away.logo_url ?? fixture.teams.away.logo ?? null
        const leagueLogoUrl =
          fixture.league.logo_url ?? fixture.league.logo ?? null

        if (!homeLogoUrl) {
          addMissing(missingInRender, {
            surface: 'match-detail',
            field: 'homeTeam.logo_url',
            fixture: sampleFixtureId,
            team: fixture.teams.home.name,
            teamExternalId: fixture.teams.home.id ?? null,
          })
        }

        if (!awayLogoUrl) {
          addMissing(missingInRender, {
            surface: 'match-detail',
            field: 'awayTeam.logo_url',
            fixture: sampleFixtureId,
            team: fixture.teams.away.name,
            teamExternalId: fixture.teams.away.id ?? null,
          })
        }

        matchDetailSamples.push({
          fixture: sampleFixtureId,
          league: fixture.league.name,
          leagueLogoUrl,
          home: fixture.teams.home.name,
          homeExternalId: fixture.teams.home.id ?? null,
          homeLogoUrl,
          away: fixture.teams.away.name,
          awayExternalId: fixture.teams.away.id ?? null,
          awayLogoUrl,
        })
      } else {
        warnings.push(`No se encontro detalle para fixture ${sampleFixtureId}.`)
      }
    }

    const mainLeagueExternalIds = uniqueValues([
      ...Object.values(TOURNAMENT_LEAGUE_EXTERNAL_IDS),
      ...homeLeagueExternalIds,
    ])
    const leagueRows = await fetchLeaguesByExternalIds(mainLeagueExternalIds)
    const leagueSamples = mainLeagueExternalIds.map((externalId) => {
      const league = leagueRows.get(externalId) ?? null
      const expectedLogoUrl = pickLeagueLogoUrl(league?.logo_url, externalId) ?? null

      if (expectedLogoUrl && !league?.logo_url) {
        addMissing(missingInRender, {
          surface: 'league-page',
          field: 'leagues.logo_url',
          leagueExternalId: externalId,
          expectedLogoUrl,
        })
      }

      return {
        externalId,
        name: league?.name ?? null,
        season: league?.season ?? null,
        logoUrl: expectedLogoUrl,
        dbLogoUrl: league?.logo_url ?? null,
        expectedLogoUrl,
      }
    })
    const teamExternalIds = uniqueValues([
      teamExternalParam,
      3700,
      446,
      ...homeTeamExternalIds.slice(0, 6),
    ])
    const teamRows = await fetchTeamsByExternalIds(teamExternalIds)
    const teamSamples = []

    for (const externalId of teamExternalIds) {
      const team = teamRows.get(externalId) ?? null
      const expectedLogoUrl = pickTeamLogoUrl(team?.logo_url, externalId) ?? null
      const detail = await getTeamDetail(Number(externalId)).catch(() => null)
      const players = await fetchPlayersForTeam(team)
      const playersWithPhoto = players.filter((player) =>
        Boolean(pickStableAssetUrl(player.photo_url, null, null))
      ).length

      if (expectedLogoUrl && !detail?.team?.team.logo_url && !detail?.team?.team.logo) {
        addMissing(missingInRender, {
          surface: 'team-page',
          field: 'team.logo_url',
          teamExternalId: externalId,
          team: team?.name ?? null,
          expectedLogoUrl,
        })
      }

      if (players.length && detail?.squad && !detail.squad.players?.length) {
        addMissing(missingInRender, {
          surface: 'team-page',
          field: 'squad.players',
          teamExternalId: externalId,
          team: team?.name ?? null,
          expectedPlayers: players.length,
        })
      }

      teamSamples.push({
        externalId,
        name: team?.name ?? null,
        logoUrl: team?.logo_url ?? null,
        expectedLogoUrl,
        renderedTeamLogoUrl: detail?.team?.team.logo_url ?? detail?.team?.team.logo ?? null,
        playersCount: players.length,
        playersWithPhoto,
        renderedPlayersCount: detail?.squad?.players?.length ?? 0,
        renderedPlayersWithPhoto:
          detail?.squad?.players?.filter((player) => Boolean(player.photo_url ?? player.photo)).length ?? 0,
        samplePlayers: players.slice(0, 5).map((player) => ({
          externalId: player.external_id ? String(player.external_id) : null,
          name: player.name,
          photoUrl: player.photo_url,
        })),
      })
    }

    return NextResponse.json(
      {
        ok: true,
        date,
        homeSamples,
        matchDetailSamples,
        leagueSamples,
        teamSamples,
        missingInRender,
        warnings,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar render de assets.',
      },
      { status: 500 }
    )
  }
}
