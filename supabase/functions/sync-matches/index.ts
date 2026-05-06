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
      elapsed?: number | null
      short: string
    }
  }
  league: {
    id: number
    name?: string
    round?: string
    country?: string
    logo?: string | null
  }
  teams: {
    home: {
      id: number
      name: string
      logo?: string | null
    }
    away: {
      id: number
      name: string
      logo?: string | null
    }
  }
  goals: {
    home: number | null
    away: number | null
  }
  score?: {
    fulltime?: {
      home: number | null
      away: number | null
    }
    penalty?: {
      home: number | null
      away: number | null
    }
  }
}

type ApiFixtureEvent = {
  id?: number | string
  team?: {
    id?: number
    name?: string
  }
  player?: {
    id?: number
    name?: string
  }
  assist?: {
    id?: number
    name?: string
  }
  time?: {
    elapsed?: number | null
    extra?: number | null
  }
  type?: string
  detail?: string | null
}

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])

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
    slug: 'copa-argentina',
    name: 'Copa Argentina',
    externalLeagueId: 130,
    season: 2026,
    country: 'World',
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

function getApiSportsTeamLogoUrl(teamId: number) {
  return `https://media.api-sports.io/football/teams/${teamId}.png`
}

function getApiSportsLeagueLogoUrl(leagueId: number) {
  return `https://media.api-sports.io/football/leagues/${leagueId}.png`
}

function pickAssetUrl(apiUrl: string | null | undefined, fallbackUrl: string) {
  const trimmed = apiUrl?.trim()
  return trimmed || fallbackUrl
}

function getEventExternalId(fixture: ApiFixture, event: ApiFixtureEvent) {
  if (event.id !== undefined && event.id !== null) return String(event.id)

  return [
    fixture.fixture.id,
    event.time?.elapsed ?? 'minute',
    event.time?.extra ?? 'no-extra',
    event.team?.id ?? 'team',
    event.player?.name ?? 'player',
    event.detail ?? 'detail',
  ].join(':')
}

function normalizeFootballEventText(value?: string | null) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isScoreboardGoalEvent(type?: string | null, detail?: string | null) {
  const normalizedType = normalizeFootballEventText(type)
  const normalizedDetail = normalizeFootballEventText(detail)

  if (normalizedType !== 'goal') return false

  if (
    normalizedDetail.includes('missed') ||
    normalizedDetail.includes('shootout') ||
    normalizedDetail.includes('penalty shoot') ||
    normalizedDetail.includes('cancelled') ||
    normalizedDetail.includes('canceled') ||
    normalizedDetail.includes('var')
  ) {
    return false
  }

  if (!normalizedDetail) return true

  return (
    normalizedDetail === 'goal' ||
    normalizedDetail.includes('normal goal') ||
    normalizedDetail.includes('penalty') ||
    normalizedDetail.includes('own goal') ||
    normalizedDetail.includes('autogol') ||
    normalizedDetail.includes('en contra')
  )
}

function isImportantLiveEvent(type?: string | null, detail?: string | null) {
  const normalizedType = normalizeFootballEventText(type)
  const normalizedDetail = normalizeFootballEventText(detail)

  if (isScoreboardGoalEvent(type, detail)) return true

  if (
    normalizedType.includes('card') &&
    (
      normalizedDetail.includes('red card') ||
      normalizedDetail === 'red' ||
      normalizedDetail.includes('roja')
    )
  ) {
    return true
  }

  return (
    normalizedType.includes('penalty') ||
    normalizedDetail === 'penalty' ||
    normalizedDetail.includes('penalty confirmed') ||
    normalizedDetail.includes('penalty awarded') ||
    normalizedDetail.includes('penalty conceded') ||
    normalizedDetail.includes('penal') ||
    (
      normalizedType.includes('var') &&
      normalizedDetail.includes('penalty')
    )
  )
}

function isImportantMatchEventForHome(event: ApiFixtureEvent) {
  const normalizedType = normalizeFootballEventText(event.type)
  const normalizedDetail = normalizeFootballEventText(event.detail)
  const isCardEvent =
    normalizedType.includes('card') &&
    (
      normalizedDetail.includes('yellow') ||
      normalizedDetail.includes('red') ||
      normalizedDetail.includes('roja')
    )

  return (
    (
      isScoreboardGoalEvent(event.type, event.detail) ||
      isCardEvent ||
      isImportantLiveEvent(event.type, event.detail)
    ) &&
    event.time?.elapsed !== null &&
    event.time?.elapsed !== undefined
  )
}

async function fetchFixtureEvents(
  footballApiBaseUrl: string,
  footballApiKey: string,
  fixtureId: number,
) {
  const eventsUrl = new URL(`${footballApiBaseUrl}/fixtures/events`)
  eventsUrl.searchParams.set('fixture', String(fixtureId))

  const response = await fetch(eventsUrl.toString(), {
    headers: { 'x-apisports-key': footballApiKey },
  })

  if (!response.ok) throw new Error(`API-Football respondio ${response.status}`)

  const payload = await response.json()
  const apiErrors = payload?.errors ? Object.values(payload.errors).filter(Boolean) : []

  if (apiErrors.length) {
    throw new Error(apiErrors.join(' | '))
  }

  return (payload?.response ?? []) as ApiFixtureEvent[]
}

async function syncMatchEvents(
  supabase: ReturnType<typeof createClient>,
  footballApiBaseUrl: string,
  footballApiKey: string,
  fixture: ApiFixture,
  matchId: string | number,
  homeTeamId: string | number,
  awayTeamId: string | number,
) {
  try {
    const events = await fetchFixtureEvents(footballApiBaseUrl, footballApiKey, fixture.fixture.id)
    const eventRows = events
      .filter(isImportantMatchEventForHome)
      .map((event) => {
        const storedMinute = event.time?.elapsed as number
        const storedExtraMinute = event.time?.extra ?? null
        const teamId =
          event.team?.id === fixture.teams.home.id
            ? homeTeamId
            : event.team?.id === fixture.teams.away.id
              ? awayTeamId
              : null

        console.info('event time', {
          fixtureId: fixture.fixture.id,
          player: event.player?.name ?? null,
          elapsed: event.time?.elapsed ?? null,
          extra: event.time?.extra ?? null,
          storedMinute,
          storedExtraMinute,
        })

        return {
          match_id: matchId,
          external_event_id: getEventExternalId(fixture, event),
          team_id: teamId,
          player_name:
            event.player?.name?.trim() ||
            event.team?.name?.trim() ||
            event.detail ||
            event.type ||
            'Evento',
          assist_name: event.assist?.name ?? null,
          minute: storedMinute,
          extra_minute: storedExtraMinute,
          type: event.type as string,
          detail: event.detail ?? null,
        }
      })

    console.info('[sync-match-events] eventos recibidos', {
      fixtureId: fixture.fixture.id,
      matchId,
      totalEvents: events.length,
      importantEvents: eventRows.length,
    })

    const deleteResponse = await supabase.from('match_events').delete().eq('match_id', matchId)

    if (deleteResponse.error) throw deleteResponse.error

    if (!eventRows.length) return { eventsFound: events.length, goalsInserted: 0 }

    const upsertResponse = await supabase
      .from('match_events')
      .upsert(eventRows, { onConflict: 'match_id,external_event_id' })

    if (upsertResponse.error) throw upsertResponse.error

    const insertedGoals = eventRows.filter((row) =>
      isScoreboardGoalEvent(row.type, row.detail)
    ).length

    console.info('[sync-match-events] eventos importantes insertados en match_events', {
      fixtureId: fixture.fixture.id,
      matchId,
      insertedEvents: eventRows.length,
      insertedGoals,
    })

    return {
      eventsFound: events.length,
      goalsInserted: insertedGoals,
    }
  } catch (error) {
    console.warn('[sync-match-events] No se pudieron sincronizar eventos; se omiten.', {
      fixtureId: fixture.fixture.id,
      message: error instanceof Error ? error.message : String(error),
    })

    return { eventsFound: 0, goalsInserted: 0 }
  }
}

async function updatePenaltyScores(
  supabase: ReturnType<typeof createClient>,
  fixture: ApiFixture,
  matchId: string | number,
) {
  const homePenaltyScore = fixture.score?.penalty?.home ?? null
  const awayPenaltyScore = fixture.score?.penalty?.away ?? null

  if (homePenaltyScore === null && awayPenaltyScore === null) return

  const { error } = await supabase
    .from('matches')
    .update({
      home_penalty_score: homePenaltyScore,
      away_penalty_score: awayPenaltyScore,
    })
    .eq('id', matchId)

  if (!error) return

  const message = error.message.toLowerCase()
  const isMissingPenaltyColumn =
    message.includes('home_penalty_score') ||
    message.includes('away_penalty_score') ||
    message.includes('schema cache')

  if (isMissingPenaltyColumn) {
    console.warn('[sync-matches] columnas de penales no disponibles; se conserva sync base.', {
      fixtureId: fixture.fixture.id,
      matchId,
      message: error.message,
    })
    return
  }

  throw error
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
      processed: 0,
      eventsFound: 0,
      goalsInserted: 0,
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
            logo_url: getApiSportsLeagueLogoUrl(tournament.externalLeagueId),
            logo_source: 'api-football',
            logo_last_synced_at: new Date().toISOString(),
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
                {
                  external_id: item.teams.home.id,
                  name: item.teams.home.name,
                  logo_url: pickAssetUrl(item.teams.home.logo, getApiSportsTeamLogoUrl(item.teams.home.id)),
                  logo_source: 'api-football',
                  logo_last_synced_at: new Date().toISOString(),
                },
                { onConflict: 'external_id' },
              )
              .select('id')
              .single(),
            supabase
              .from('teams')
              .upsert(
                {
                  external_id: item.teams.away.id,
                  name: item.teams.away.name,
                  logo_url: pickAssetUrl(item.teams.away.logo, getApiSportsTeamLogoUrl(item.teams.away.id)),
                  logo_source: 'api-football',
                  logo_last_synced_at: new Date().toISOString(),
                },
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

          result.processed += 1

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
            elapsed: FINISHED_STATUSES.has(item.fixture.status.short)
              ? null
              : item.fixture.status.elapsed ?? null,
            home_score: item.goals.home,
            away_score: item.goals.away,
          }

          const matchResult = existing
            ? await supabase
              .from('matches')
              .update(matchPayload)
              .eq('id', existing.id)
              .select('id')
              .single()
            : await supabase
              .from('matches')
              .insert(matchPayload)
              .select('id')
              .single()

          if (matchResult.error && !existing) {
            const fallbackResult = await supabase
              .from('matches')
              .insert({
                id: item.fixture.id,
                ...matchPayload,
              })
              .select('id')
              .single()

            if (!fallbackResult.error && fallbackResult.data?.id) {
              await updatePenaltyScores(supabase, item, fallbackResult.data.id)
              const eventSync = await syncMatchEvents(
                supabase,
                footballApiBaseUrl,
                footballApiKey,
                item,
                fallbackResult.data.id,
                homeTeam.id,
                awayTeam.id,
              )
              result.eventsFound += eventSync.eventsFound
              result.goalsInserted += eventSync.goalsInserted
              result.created += 1
              continue
            }

            throw new Error(
              `${matchResult.error.message}; fallback con id fallo: ${fallbackResult.error?.message}`,
            )
          }

          if (matchResult.error) throw new Error(matchResult.error.message)

          const matchId = existing?.id ?? matchResult.data?.id
          if (!matchId) throw new Error(`No se pudo resolver id interno del fixture ${item.fixture.id}`)

          await updatePenaltyScores(supabase, item, matchId)

          const eventSync = await syncMatchEvents(
            supabase,
            footballApiBaseUrl,
            footballApiKey,
            item,
            matchId,
            homeTeam.id,
            awayTeam.id,
          )
          result.eventsFound += eventSync.eventsFound
          result.goalsInserted += eventSync.goalsInserted

          if (existing) result.updated += 1
          else result.created += 1
        } catch (error) {
          result.errors.push(error instanceof Error ? error.message : 'Error desconocido')
        }
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Error desconocido')
    }

    console.info('[sync-matches] resumen torneo', {
      tournament: tournament.slug,
      fixturesProcessed: result.processed,
      eventsFound: result.eventsFound,
      goalsInserted: result.goalsInserted,
    })

    tournaments.push(result)
  }

  return json({
    ok: true,
    processedTournaments: tournaments.length,
    created: tournaments.reduce((sum, item) => sum + item.created, 0),
    updated: tournaments.reduce((sum, item) => sum + item.updated, 0),
    processed: tournaments.reduce((sum, item) => sum + item.processed, 0),
    eventsFound: tournaments.reduce((sum, item) => sum + item.eventsFound, 0),
    goalsInserted: tournaments.reduce((sum, item) => sum + item.goalsInserted, 0),
    skipped: tournaments.reduce((sum, item) => sum + item.skipped, 0),
    tournaments,
  })
})
