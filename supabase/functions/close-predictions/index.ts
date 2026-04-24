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

  return json({
    ok: true,
    closedBy: 'database-trigger',
    note: 'Las predicciones se bloquean por trigger en predictions y por save-prediction 15 minutos antes.',
  })
})
