import 'server-only'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import type { FootballApiRequestErrorCode } from '@/server/integrations/football-api-client'

const USAGE_TRACKING_TIMEOUT_MS = 800

export type FootballApiUsageInput = {
  endpoint: string
  context: string
  ok: boolean
  status: number | null
  errorCode: FootballApiRequestErrorCode | null
  durationMs: number
}

function isUsageTrackingEnabled() {
  return process.env.FOOTBALL_API_USAGE_TRACKING_ENABLED === 'true'
}

async function withUsageTrackingTimeout<T>(promise: PromiseLike<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('football_api_usage_tracking_timeout'))
        }, USAGE_TRACKING_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function recordFootballApiUsage(input: FootballApiUsageInput) {
  if (!isUsageTrackingEnabled()) return

  try {
    const supabase = getSupabaseAdminClient()
    const response = await withUsageTrackingTimeout(
      supabase.rpc('record_football_api_usage', {
        p_endpoint: input.endpoint,
        p_context: input.context,
        p_ok: input.ok,
        p_status: input.status,
        p_error_code: input.errorCode,
        p_duration_ms: Math.max(0, Math.round(input.durationMs)),
      })
    )

    if (response.error) {
      console.warn('[football-api] usage tracking failed', {
        endpoint: input.endpoint,
        context: input.context,
        code: response.error.code ?? null,
        message: response.error.message,
      })
    }
  } catch (error) {
    console.warn('[football-api] usage tracking skipped', {
      endpoint: input.endpoint,
      context: input.context,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
