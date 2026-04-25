import type { Prediction } from '@/frontend/types/prode'
import { getCurrentSession } from '@/lib/supabase/supabaseClient'

async function getAuthHeaders() {
  const session = await getCurrentSession()

  if (!session?.access_token) {
    return undefined
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
  }
}

export async function getMyPredictions() {
  const authHeaders = await getAuthHeaders()
  const response = await fetch('/api/prode/my-predictions', {
    cache: 'no-store',
    credentials: 'include',
    headers: authHeaders,
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error || 'No se pudieron cargar tus predicciones.')
  }

  return data.predictions as Prediction[]
}

export async function savePrediction(input: {
  matchId: string
  predictedHomeScore: number
  predictedAwayScore: number
}) {
  const authHeaders = await getAuthHeaders()
  const response = await fetch('/api/prode/predictions', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(input),
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo guardar la predicción.')
  }

  return data.prediction as Prediction
}
