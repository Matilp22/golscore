export type FootballApiPayload<T> = {
  errors?: Record<string, string>
  results?: number
  response?: T
}

type FootballApiRequestOptions = {
  logContext: string
}

const RATE_LIMIT_BACKOFF_MS = 30 * 60 * 1000

let rateLimitBackoffUntil = 0
let lastBackoffLogAt = 0

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

function getErrorMessages(errors?: Record<string, string>) {
  return Object.values(errors ?? {})
    .map((value) => String(value).toLowerCase())
    .filter(Boolean)
}

function isFootballApiRateLimit(
  status: number,
  errors?: Record<string, string>
) {
  if (status === 429) return true

  return getErrorMessages(errors).some((message) =>
    message.includes('rate limit') ||
    message.includes('request limit') ||
    message.includes('too many requests') ||
    message.includes('limit for the day') ||
    message.includes('reached the request limit')
  )
}

function getRetryAfterMs(response: Response) {
  const retryAfter = response.headers.get('retry-after')
  if (!retryAfter) return RATE_LIMIT_BACKOFF_MS

  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.max(seconds * 1000, 60 * 1000)
  }

  const retryAt = new Date(retryAfter).getTime()
  if (Number.isFinite(retryAt)) {
    return Math.max(retryAt - Date.now(), 60 * 1000)
  }

  return RATE_LIMIT_BACKOFF_MS
}

function setRateLimitBackoff(ms = RATE_LIMIT_BACKOFF_MS) {
  rateLimitBackoffUntil = Math.max(rateLimitBackoffUntil, Date.now() + ms)
}

function buildRateLimitPayload<T>(message: string): FootballApiPayload<T> {
  return {
    errors: {
      requests: message,
    },
    results: 0,
    response: [] as T,
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
  const now = Date.now()

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

  if (now < rateLimitBackoffUntil) {
    if (now - lastBackoffLogAt > 60 * 1000) {
      lastBackoffLogAt = now
      console.warn('[football-api] request skipped by rate-limit backoff', {
        endpoint: path,
        source: options.logContext,
        retryAt: new Date(rateLimitBackoffUntil).toISOString(),
      })
    }

    return {
      status: 429,
      payload: buildRateLimitPayload<T>(
        `API-Football rate limit backoff active until ${new Date(rateLimitBackoffUntil).toISOString()}`
      ),
    }
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

  if (isFootballApiRateLimit(response.status, payload?.errors)) {
    setRateLimitBackoff(getRetryAfterMs(response))

    return {
      status: response.status,
      payload: payload ?? buildRateLimitPayload<T>('API-Football rate limit exceeded.'),
    }
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
