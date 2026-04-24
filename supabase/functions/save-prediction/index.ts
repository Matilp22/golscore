import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function normalizeSupabaseUrl(value: string) {
  return value.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true })

  if (req.method !== 'POST') {
    return json({ error: 'Metodo no permitido' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !anonKey || !authHeader) {
    return json({ error: 'Configuracion incompleta' }, 500)
  }

  const supabase = createClient(normalizeSupabaseUrl(supabaseUrl), anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return json({ error: 'No autorizado' }, 401)
  }

  const body = await req.json().catch(() => null)
  const matchId = Number(body?.matchId)
  const predictedHomeScore = Number(body?.predictedHomeScore)
  const predictedAwayScore = Number(body?.predictedAwayScore)

  if (
    !Number.isInteger(matchId) ||
    !Number.isInteger(predictedHomeScore) ||
    !Number.isInteger(predictedAwayScore) ||
    predictedHomeScore < 0 ||
    predictedAwayScore < 0
  ) {
    return json({ error: 'Datos invalidos' }, 400)
  }

  const { data: match } = await supabase
    .from('matches')
    .select('id, match_date')
    .eq('id', matchId)
    .single()

  if (!match) {
    return json({ error: 'Partido no encontrado' }, 404)
  }

  if (Date.now() >= new Date(match.match_date).getTime() - 15 * 60 * 1000) {
    return json({ error: 'Prediccion bloqueada' }, 403)
  }

  const { data, error } = await supabase
    .from('predictions')
    .upsert(
      {
        user_id: userData.user.id,
        match_id: matchId,
        predicted_home_score: predictedHomeScore,
        predicted_away_score: predictedAwayScore,
      },
      { onConflict: 'user_id,match_id' },
    )
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)

  return json({ prediction: data })
})
