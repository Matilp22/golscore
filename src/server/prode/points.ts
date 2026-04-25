import type { SupabaseClient } from '@supabase/supabase-js'

export type RecalculateProdePointsResult = {
  matchId: string | number | null
}

type SupabaseRpcError = {
  message?: string
  details?: string
  detail?: string
  hint?: string
  code?: string
}

export class ProdePointsRecalculationError extends Error {
  code?: string
  detail?: string

  constructor(error: SupabaseRpcError) {
    const detail = error.details ?? error.detail ?? error.hint

    super(error.message ?? 'No se pudieron recalcular los puntos del prode.')

    this.name = 'ProdePointsRecalculationError'
    this.code = error.code
    this.detail = detail
  }
}

const FINAL_MATCH_STATUSES = new Set([
  'final',
  'ft',
  'aet',
  'pen',
  'finished',
  'match finished',
])

export function isFinalProdeStatus(status: string | null | undefined) {
  return FINAL_MATCH_STATUSES.has((status || '').trim().toLowerCase())
}

export async function recalculateProdePoints(
  supabase: SupabaseClient,
  matchId: string | number | null = null
): Promise<RecalculateProdePointsResult> {
  const targetMatchId =
    matchId === null || matchId === undefined || matchId === ''
      ? null
      : Number(matchId)

  if (targetMatchId !== null && !Number.isFinite(targetMatchId)) {
    throw new Error('matchId invalido para recalcular puntos.')
  }

  const { error } = await supabase.rpc('recalculate_prediction_scores', {
    target_match_id: targetMatchId,
  })

  if (error) {
    throw new ProdePointsRecalculationError(error)
  }

  return {
    matchId: targetMatchId,
  }
}
