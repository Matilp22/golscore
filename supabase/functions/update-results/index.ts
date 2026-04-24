import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type ApiFixture = {
  fixture: {
    id: number
    status: {
      short: string
    }
  }
  goals: {
    home: number | null
    away: number | null
  }
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  const body = await req.json().catch(() => null)
  const fixtureId = body?.fixtureId ? Number(body.fixtureId) : null
  const date = body?.date || new Date().toISOString().slice(0, 10)
  const timezone = body?.timezone || 'America/Argentina/Buenos_Aires'

  const url = new URL(`${footballApiBaseUrl}/fixtures`)
  if (fixtureId) {
    url.searchParams.set('id', String(fixtureId))
  } else {
    url.searchParams.set('date', date)
    url.searchParams.set('timezone', timezone)
  }

  const response = await fetch(url.toString(), {
    headers: {
      'x-apisports-key': footballApiKey,
    },
  })

  if (!response.ok) {
    return json({ error: `API-Football respondio ${response.status}` }, 502)
  }

  const payload = await response.json()
  const fixtures = (payload?.response ?? []) as ApiFixture[]
  const supabase = createClient(normalizeUrl(supabaseUrl), serviceRoleKey)
  const finalStatuses = new Set(['FT', 'AET', 'PEN'])
  let updated = 0

  for (const item of fixtures) {
    if (
      !finalStatuses.has(item.fixture.status.short) ||
      item.goals.home === null ||
      item.goals.away === null
    ) {
      continue
    }

    await supabase
      .from('matches')
      .update({
        home_score: item.goals.home,
        away_score: item.goals.away,
        status: item.fixture.status.short,
      })
      .eq('id', item.fixture.id)

    await supabase
      .from('results')
      .upsert(
        {
          match_id: item.fixture.id,
          home_score: item.goals.home,
          away_score: item.goals.away,
          status: item.fixture.status.short,
          source: 'api-football',
          recorded_at: new Date().toISOString(),
        },
        { onConflict: 'match_id' },
      )

    await supabase.rpc('recalculate_prediction_scores', {
      target_match_id: item.fixture.id,
    })

    updated += 1
  }

  return json({
    ok: true,
    checked: fixtures.length,
    updated,
  })
})
