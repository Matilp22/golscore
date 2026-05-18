export type FootballApiPayload<T> = {
  errors?: Record<string, string>
  results?: number
  response?: T
}

type FootballApiRequestOptions = {
  logContext: string
}

function getFootballApiClientConfig() {
  const apiKey = process.env.FOOTBALL_API_KEY
  const baseUrl = (
    process.env.FOOTBALL_API_BASE_URL || 'https://v3.football.api-sports.io'
  )
    .trim()
    .replace(/\/+$/, '')

  return {
    apiKey,
    baseUrl,
    hasApiKey: Boolean(apiKey),
  }
}

export async function requestFootballApi<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  options: FootballApiRequestOptions
) {
  const { apiKey, baseUrl, hasApiKey } = getFootballApiClientConfig()
  const url = new URL(`${baseUrl}${path}`)
  const shouldLog = process.env.NODE_ENV === 'development'

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })

  if (shouldLog) {
    console.info(`[football-api:${options.logContext}] key configured: ${hasApiKey}`)
    console.info(`[football-api:${options.logContext}] base url: ${baseUrl}`)
    console.info(`[football-api:${options.logContext}] request: ${url.pathname}${url.search}`)
    console.info('[api-football-call]', {
      source: options.logContext,
      endpoint: path,
      params: Object.fromEntries(url.searchParams.entries()),
    })
  }

  if (!apiKey) {
    throw new Error('Falta FOOTBALL_API_KEY en el entorno.')
  }

  const response = await fetch(url.toString(), {
    headers: {
      'x-apisports-key': apiKey,
    },
    cache: 'no-store',
  })

  if (shouldLog) {
    console.info(`[football-api:${options.logContext}] status: ${response.status}`)
  }

  const payload = (await response.json().catch(() => null)) as FootballApiPayload<T> | null
  const responseLength = Array.isArray(payload?.response) ? payload.response.length : null

  if (shouldLog) {
    console.info(`[football-api:${options.logContext}] payload parsed: ${Boolean(payload)}`)
    console.info(`[football-api:${options.logContext}] response length: ${responseLength}`)
  }

  if (payload?.errors && Object.keys(payload.errors).length > 0) {
    console.warn(`[football-api:${options.logContext}] errors: ${JSON.stringify(payload.errors)}`)
  }

  if (!response.ok) {
    throw new Error(`API-Football respondio ${response.status}`)
  }

  if (!payload) {
    throw new Error('API-Football no devolvio JSON valido.')
  }

  return {
    status: response.status,
    payload,
  }
}
