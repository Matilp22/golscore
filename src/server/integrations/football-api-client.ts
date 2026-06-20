import 'server-only'

import { AsyncLocalStorage } from 'node:async_hooks'

import { recordFootballApiUsage } from '@/server/integrations/football-api-usage'

export type FootballApiPayload<T> = {
  errors?: Record<string, string>
  results?: number
  response?: T
}

export type FootballApiRequestErrorCode =
  | 'missing_api_key'
  | 'timeout'
  | 'network_error'
  | 'http_error'
  | 'provider_error'
  | 'rate_limit'
  | 'invalid_json'
  | 'provider_call_blocked_in_public_read'

export class FootballApiRequestError extends Error {
  code: FootballApiRequestErrorCode
  status?: number
  endpoint: string
  context: string
  cause?: unknown

  constructor(
    message: string,
    input: {
      code: FootballApiRequestErrorCode
      status?: number
      endpoint: string
      context: string
      cause?: unknown
    }
  ) {
    super(message)
    this.name = 'FootballApiRequestError'
    this.code = input.code
    this.status = input.status
    this.endpoint = input.endpoint
    this.context = input.context
    this.cause = input.cause
  }
}

export type FootballApiRequestOptions = {
  logContext: string
  usageContext?: string
  timeoutMs?: number
}

export type FootballApiCallRecord = {
  endpoint: string
  context: string
  status: number | null
  ok: boolean
  errorCode: FootballApiRequestErrorCode | null
  durationMs: number
}

type FootballApiReadAuditState = {
  route: string
  cacheOnly: boolean
  providerCalls: FootballApiCallRecord[]
  blockedProviderCalls: FootballApiCallRecord[]
}

const RATE_LIMIT_BACKOFF_MS = 30 * 60 * 1000
const DEFAULT_FOOTBALL_API_TIMEOUT_MS = 8000

let rateLimitBackoffUntil = 0
let lastBackoffLogAt = 0
const footballApiReadAudit = new AsyncLocalStorage<FootballApiReadAuditState>()

export async function runWithFootballApiCallAudit<T>(
  callback: () => Promise<T>
): Promise<{ result: T; providerCalls: FootballApiCallRecord[] }> {
  const audited = await runWithFootballApiReadAudit(
    { route: 'other', cacheOnly: false },
    callback
  )

  return { result: audited.result, providerCalls: audited.providerCalls }
}

export async function runWithFootballApiReadAudit<T>(
  input: { route: string; cacheOnly: boolean },
  callback: () => Promise<T>
): Promise<{
  result: T
  providerCalls: FootballApiCallRecord[]
  blockedProviderCalls: FootballApiCallRecord[]
}> {
  const state: FootballApiReadAuditState = {
    route: input.route,
    cacheOnly: input.cacheOnly,
    providerCalls: [],
    blockedProviderCalls: [],
  }
  const result = await footballApiReadAudit.run(state, callback)

  return {
    result,
    providerCalls: state.providerCalls,
    blockedProviderCalls: state.blockedProviderCalls,
  }
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

function getTimeoutMs(options: FootballApiRequestOptions) {
  const configured = Number(process.env.FOOTBALL_API_TIMEOUT_MS)
  const timeoutMs = options.timeoutMs ?? configured

  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_FOOTBALL_API_TIMEOUT_MS
}

function normalizeEndpoint(path: string) {
  const endpoint = path.split('?')[0]?.trim() || 'unknown'

  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`
}

function normalizeContextPart(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0-9a-f]{8,}/gi, 'id')
    .replace(/\b\d+\b/g, 'id')
    .replace(/[^a-z0-9:_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-:_]+|[-:_]+$/g, '')
}

function normalizeUsageContext(options: FootballApiRequestOptions) {
  const raw = options.usageContext?.trim() || options.logContext?.trim() || 'other'
  const normalized = normalizeContextPart(raw)
  const stablePrefix = normalized.split(':').find(Boolean)

  return stablePrefix || 'other'
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof DOMException && error.name === 'AbortError'
  ) || (
    error instanceof Error && error.name === 'AbortError'
  )
}

function blockProviderCallInCacheOnlyRead(endpoint: string, context: string) {
  const auditState = footballApiReadAudit.getStore()

  if (!auditState?.cacheOnly) return

  const record: FootballApiCallRecord = {
    endpoint,
    context,
    status: null,
    ok: false,
    errorCode: 'provider_call_blocked_in_public_read',
    durationMs: 0,
  }

  auditState.blockedProviderCalls.push(record)

  throw new FootballApiRequestError(
    `API-Football bloqueado durante lectura publica cache-only (${auditState.route}).`,
    {
      code: 'provider_call_blocked_in_public_read',
      endpoint,
      context,
    }
  )
}

function startProviderCallAudit(endpoint: string, context: string) {
  const auditState = footballApiReadAudit.getStore()

  if (!auditState) return null

  const record: FootballApiCallRecord = {
    endpoint,
    context,
    status: null,
    ok: false,
    errorCode: null,
    durationMs: 0,
  }

  auditState.providerCalls.push(record)

  return record
}

async function finishProviderCall(input: {
  auditRecord: FootballApiCallRecord | null
  endpoint: string
  context: string
  ok: boolean
  status: number | null
  errorCode: FootballApiRequestErrorCode | null
  startedAt: number
}) {
  const durationMs = Date.now() - input.startedAt

  if (input.auditRecord) {
    input.auditRecord.status = input.status
    input.auditRecord.ok = input.ok
    input.auditRecord.errorCode = input.errorCode
    input.auditRecord.durationMs = durationMs
  }

  await recordFootballApiUsage({
    endpoint: input.endpoint,
    context: input.context,
    ok: input.ok,
    status: input.status,
    errorCode: input.errorCode,
    durationMs,
  })
}

export async function requestFootballApi<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  options: FootballApiRequestOptions
) {
  const { apiKey, baseUrl, hasApiKey } = getFootballApiClientConfig()
  const url = new URL(`${baseUrl}${path}`)
  const endpoint = normalizeEndpoint(path)
  const usageContext = normalizeUsageContext(options)
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

  blockProviderCallInCacheOnlyRead(endpoint, usageContext)

  if (!apiKey) {
    throw new FootballApiRequestError('Falta FOOTBALL_API_KEY en el entorno.', {
      code: 'missing_api_key',
      endpoint,
      context: usageContext,
    })
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

  const controller = new AbortController()
  const timeoutMs = getTimeoutMs(options)
  const startedAt = Date.now()
  const auditRecord = startProviderCallAudit(endpoint, usageContext)
  let timeoutReached = false
  const timeoutId = setTimeout(() => {
    timeoutReached = true
    controller.abort()
  }, timeoutMs)
  let response: Response

  try {
    response = await fetch(url.toString(), {
      headers: {
        'x-apisports-key': apiKey,
      },
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (error) {
    const code: FootballApiRequestErrorCode =
      timeoutReached || isTimeoutError(error) ? 'timeout' : 'network_error'

    await finishProviderCall({
      auditRecord,
      endpoint,
      context: usageContext,
      ok: false,
      status: null,
      errorCode: code,
      startedAt,
    })

    throw new FootballApiRequestError(
      code === 'timeout'
        ? `API-Football supero el timeout de ${timeoutMs}ms.`
        : 'No se pudo conectar con API-Football.',
      {
        code,
        endpoint,
        context: usageContext,
        cause: error,
      }
    )
  } finally {
    clearTimeout(timeoutId)
  }

  if (shouldLog) {
    console.info(`[football-api:${options.logContext}] status: ${response.status}`)
  }

  let payload: FootballApiPayload<T> | null = null

  try {
    payload = (await response.json()) as FootballApiPayload<T>
  } catch (error) {
    await finishProviderCall({
      auditRecord,
      endpoint,
      context: usageContext,
      ok: false,
      status: response.status,
      errorCode: 'invalid_json',
      startedAt,
    })

    throw new FootballApiRequestError('API-Football no devolvio JSON valido.', {
      code: 'invalid_json',
      status: response.status,
      endpoint,
      context: usageContext,
      cause: error,
    })
  }

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
    await finishProviderCall({
      auditRecord,
      endpoint,
      context: usageContext,
      ok: false,
      status: response.status,
      errorCode: 'rate_limit',
      startedAt,
    })

    return {
      status: response.status,
      payload: payload ?? buildRateLimitPayload<T>('API-Football rate limit exceeded.'),
    }
  }

  if (!response.ok) {
    const hasProviderErrors = Boolean(payload?.errors && Object.keys(payload.errors).length > 0)
    const code: FootballApiRequestErrorCode = hasProviderErrors ? 'provider_error' : 'http_error'

    await finishProviderCall({
      auditRecord,
      endpoint,
      context: usageContext,
      ok: false,
      status: response.status,
      errorCode: code,
      startedAt,
    })

    throw new FootballApiRequestError(`API-Football respondio ${response.status}`, {
      code,
      status: response.status,
      endpoint,
      context: usageContext,
    })
  }

  if (!payload) {
    await finishProviderCall({
      auditRecord,
      endpoint,
      context: usageContext,
      ok: false,
      status: response.status,
      errorCode: 'invalid_json',
      startedAt,
    })

    throw new FootballApiRequestError('API-Football no devolvio JSON valido.', {
      code: 'invalid_json',
      status: response.status,
      endpoint,
      context: usageContext,
    })
  }

  await finishProviderCall({
    auditRecord,
    endpoint,
    context: usageContext,
    ok: !(payload.errors && Object.keys(payload.errors).length > 0),
    status: response.status,
    errorCode:
      payload.errors && Object.keys(payload.errors).length > 0
        ? 'provider_error'
        : null,
    startedAt,
  })

  return {
    status: response.status,
    payload,
  }
}
