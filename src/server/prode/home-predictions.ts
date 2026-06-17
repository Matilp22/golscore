import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export type HomeProdePrediction = {
  predictedHomeScore: number
  predictedAwayScore: number
}

type MatchRef = {
  id: string | number
  externalId?: string | number | null
}

type ProfilePreferenceRow = {
  show_home_predictions?: boolean | null
}

type MatchIdRow = {
  id: string | number
  external_id?: string | number | null
}

type PredictionRow = {
  match_id: string | number
  predicted_home_score: number
  predicted_away_score: number
}

type SupabaseError = {
  code?: string
  message?: string
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function isMissingOptionalProfilePreference(error: SupabaseError | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    message.includes('show_home_predictions') ||
    message.includes('schema cache')
  )
}

async function userWantsHomePredictions(userId: string) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('show_home_predictions')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    if (isMissingOptionalProfilePreference(error)) return false
    throw error
  }

  return Boolean((data as ProfilePreferenceRow | null)?.show_home_predictions)
}

function getMatchRefKey(match: MatchRef) {
  return String(match.externalId ?? match.id)
}

function getUniqueMatchRefKeys(matches: MatchRef[]) {
  return [
    ...new Set(
      matches
        .flatMap((match) => [match.id, match.externalId ?? null])
        .filter((value): value is string | number => value !== null && value !== undefined)
        .map(String)
    ),
  ]
}

async function resolveStoredMatchIds(matchRefs: MatchRef[]) {
  const supabase = getSupabaseAdminClient()
  const rawKeys = getUniqueMatchRefKeys(matchRefs)
  const storedMatchIdsByLookupKey = new Map<string, string>()

  rawKeys.forEach((key) => storedMatchIdsByLookupKey.set(key, key))

  for (const chunk of chunkArray(rawKeys, 80)) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, external_id')
      .in('external_id', chunk)

    if (error) {
      const message = error.message.toLowerCase()
      const missingExternalId =
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        message.includes('external_id') ||
        message.includes('schema cache')

      if (missingExternalId) break
      throw error
    }

    for (const row of (data ?? []) as MatchIdRow[]) {
      const storedId = String(row.id)

      storedMatchIdsByLookupKey.set(storedId, storedId)
      if (row.external_id !== null && row.external_id !== undefined) {
        storedMatchIdsByLookupKey.set(String(row.external_id), storedId)
      }
    }
  }

  return storedMatchIdsByLookupKey
}

async function fetchUserPredictionsByMatchIds(userId: string, matchIds: string[]) {
  const supabase = getSupabaseAdminClient()
  const predictionsByMatchId = new Map<string, HomeProdePrediction>()

  for (const chunk of chunkArray([...new Set(matchIds)], 80)) {
    const { data, error } = await supabase
      .from('predictions')
      .select('match_id, predicted_home_score, predicted_away_score')
      .eq('user_id', userId)
      .in('match_id', chunk)

    if (error) throw error

    for (const prediction of (data ?? []) as PredictionRow[]) {
      predictionsByMatchId.set(String(prediction.match_id), {
        predictedHomeScore: prediction.predicted_home_score,
        predictedAwayScore: prediction.predicted_away_score,
      })
    }
  }

  return predictionsByMatchId
}

export async function getHomeProdePredictions(matchRefs: MatchRef[]) {
  const predictionsByHomeMatchKey = new Map<string, HomeProdePrediction>()
  const uniqueRefs = matchRefs.filter((match, index, all) =>
    all.findIndex((candidate) => getMatchRefKey(candidate) === getMatchRefKey(match)) === index
  )

  if (!uniqueRefs.length) return predictionsByHomeMatchKey

  const supabase = await getSupabaseServerClient()
  if (!supabase) return predictionsByHomeMatchKey

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return predictionsByHomeMatchKey

  try {
    const enabled = await userWantsHomePredictions(user.id)
    if (!enabled) return predictionsByHomeMatchKey

    const storedMatchIdsByLookupKey = await resolveStoredMatchIds(uniqueRefs)
    const storedMatchIds = uniqueRefs
      .map((match) =>
        storedMatchIdsByLookupKey.get(String(match.externalId ?? match.id)) ??
        storedMatchIdsByLookupKey.get(String(match.id)) ??
        String(match.id)
      )
      .filter(Boolean)
    const predictionsByMatchId = await fetchUserPredictionsByMatchIds(user.id, storedMatchIds)

    for (const match of uniqueRefs) {
      const homeKey = getMatchRefKey(match)
      const storedMatchId =
        storedMatchIdsByLookupKey.get(String(match.externalId ?? match.id)) ??
        storedMatchIdsByLookupKey.get(String(match.id)) ??
        String(match.id)
      const prediction = predictionsByMatchId.get(storedMatchId)

      if (!prediction) continue

      predictionsByHomeMatchKey.set(homeKey, prediction)
      predictionsByHomeMatchKey.set(String(match.id), prediction)
    }
  } catch (error) {
    console.error('[home-prode-predictions] No se pudieron cargar predicciones de la home', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return predictionsByHomeMatchKey
}
