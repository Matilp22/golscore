import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function normalizeSupabaseUrl(value: string) {
  return value.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-cron-secret, content-type',
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

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Configuracion incompleta' }, 500)
  }

  const supabase = createClient(normalizeSupabaseUrl(supabaseUrl), serviceRoleKey)
  const body = await req.json().catch(() => null)
  const { error } = await supabase.rpc('recalculate_prediction_scores', {
    target_match_id: body?.matchId ?? null,
  })

  if (error) return json({ error: error.message }, 500)

  return json({ ok: true })
})
