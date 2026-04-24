import type { Match } from '@/frontend/types/prode'

type GetMatchesFilters = {
  leagueId?: string
  round?: string
  status?: string
  date?: string
}

export async function getMatches(filters: GetMatchesFilters = {}) {
  const params = new URLSearchParams()

  if (filters.leagueId) params.set('leagueId', String(filters.leagueId))
  if (filters.round) params.set('round', filters.round)
  if (filters.status) params.set('status', filters.status)
  if (filters.date) params.set('date', filters.date)

  const url = `/api/prode/matches${params.size ? `?${params.toString()}` : ''}`
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error || 'No se pudieron cargar los partidos.')
  }

  return data.matches as Match[]
}
