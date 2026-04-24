import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Tournament = {
  slug: string
  name: string
  externalLeagueId: number
  season: number
  country: string
}

type ApiFixture = {
  fixture: {
    id: number
    date: string
    status: {
      short: string
    }
  }
  league: {
    id: number
    round?: string
    country?: string
  }
  teams: {
    home: {
      id: number
      name: string
    }
    away: {
      id: number
      name: string
    }
  }
  goals: {
    home: number | null
    away: number | null
  }
}

const TOURNAMENTS: Tournament[] = [
  {
    slug: 'liga-profesional-argentina',
    name: 'Liga Profesional Argentina',
    externalLeagueId: 128,
    season: 2026,
    country: 'Argentina',
  },
  {
    slug: 'primera-b-nacional',
    name: 'Primera B Nacional',
    externalLeagueId: 129,
    season: 2026,
    country: 'Argentina',
  },
  {
    slug: 'mundial-2026',
    name: 'Mundial 2026',
    externalLeagueId: 1,
    season: 2026,
    country: 'World',
  },
]

function getFixtureRoundValue(round?: string | null) {
  const normalizedRound = round?.trim()

  return normalizedRound ? normalizedRound : null
}

function normalizeUrl(value: string) {
  return value.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'x-cron-secret, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true })

  const cronSecret = Deno.env.get('CRON_SECRET')

  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'No autorizado' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const footballApiKey = Deno.env.get('FOOTBALL_API_KEY')
  const footballApiBaseUrl = normalizeUrl(
    Deno.env.get('FOOTBALL_API_BASE_URL') || 'https://v3.football.api-sports.io',
  )

  if (!supabaseUrl || !serviceRoleKey || !footballApiKey) {
    return json({ error: 'Configuracion incompleta' }, 500)
  }

  const url = new URL(req.url)
  const body = req.method === 'POST' ? await req.json().catch(() => null) : null
  const competition = url.searchParams.get('competition') || body?.competition || null
  const selected = competition
    ? TOURNAMENTS.filter((tournament) => tournament.slug === competition)
    : TOURNAMENTS

  if (competition && !selected.length) {
    return json({ error: `Torneo no permitido: ${competition}` }, 400)
  }

  const supabase = createClient(normalizeUrl(supabaseUrl), serviceRoleKey)
  const tournaments = []

  for (const tournament of selected) {
    const result = {
      slug: tournament.slug,
      name: tournament.name,
      externalLeagueId: tournament.externalLeagueId,
      season: tournament.season,
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    }

    try {
      const fixturesUrl = new URL(`${footballApiBaseUrl}/fixtures`)
      fixturesUrl.searchParams.set('league', String(tournament.externalLeagueId))
      fixturesUrl.searchParams.set('season', String(tournament.season))
      fixturesUrl.searchParams.set('timezone', 'America/Argentina/Buenos_Aires')

      const response = await fetch(fixturesUrl.toString(), {
        headers: { 'x-apisports-key': footballApiKey },
      })

      if (!response.ok) throw new Error(`API-Football respondio ${response.status}`)

      const payload = await response.json()
      const fixtures = (payload?.response ?? []) as ApiFixture[]
      result.fetched = fixtures.length

      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .upsert(
          {
            external_id: tournament.externalLeagueId,
            name: tournament.name,
            country: tournament.country,
            season: tournament.season,
          },
          { onConflict: 'external_id' },
        )
        .select('id')
        .single()

      if (leagueError) throw new Error(leagueError.message)

      for (const item of fixtures) {
        try {
          const [{ data: homeTeam }, { data: awayTeam }] = await Promise.all([
            supabase
              .from('teams')
              .upsert(
                { external_id: item.teams.home.id, name: item.teams.home.name },
                { onConflict: 'external_id' },
              )
              .select('id')
              .single(),
            supabase
              .from('teams')
              .upsert(
                { external_id: item.teams.away.id, name: item.teams.away.name },
                { onConflict: 'external_id' },
              )
              .select('id')
              .single(),
          ])

          if (!homeTeam?.id || !awayTeam?.id) {
            result.skipped += 1
            continue
          }

          if (item.league.id !== tournament.externalLeagueId) {
            result.skipped += 1
            result.errors.push(
              `Fixture ${item.fixture.id} ignorado: pertenece a liga ${item.league.id}, no a ${tournament.externalLeagueId}.`,
            )
            continue
          }

          const { data: existing } = await supabase
            .from('matches')
            .select('id')
            .eq('external_id', item.fixture.id)
            .maybeSingle()

          const matchPayload = {
            external_id: item.fixture.id,
            league_id: league.id,
            home_team_id: homeTeam.id,
            away_team_id: awayTeam.id,
            match_date: item.fixture.date,
            round: getFixtureRoundValue(item.league.round),
            status: item.fixture.status.short,
            home_score: item.goals.home,
            away_score: item.goals.away,
          }

          const { error: matchError } = existing
            ? await supabase.from('matches').update(matchPayload).eq('id', existing.id)
            : await supabase.from('matches').insert(matchPayload)

          if (matchError && !existing) {
            const { error: fallbackError } = await supabase
              .from('matches')
              .insert({
                id: item.fixture.id,
                ...matchPayload,
              })

            if (!fallbackError) {
              result.created += 1
              continue
            }

            throw new Error(
              `${matchError.message}; fallback con id fallo: ${fallbackError.message}`,
            )
          }

          if (matchError) throw new Error(matchError.message)
          if (existing) result.updated += 1
          else result.created += 1
        } catch (error) {
          result.errors.push(error instanceof Error ? error.message : 'Error desconocido')
        }
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Error desconocido')
    }

    tournaments.push(result)
  }

  return json({
    ok: true,
    processedTournaments: tournaments.length,
    created: tournaments.reduce((sum, item) => sum + item.created, 0),
    updated: tournaments.reduce((sum, item) => sum + item.updated, 0),
    skipped: tournaments.reduce((sum, item) => sum + item.skipped, 0),
    tournaments,
  })
})
