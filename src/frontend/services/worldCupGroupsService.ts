import type { GroupStanding } from '@/frontend/types/prode'

export async function getWorldCupGroups(filters: { leagueId?: string | null } = {}) {
  const params = new URLSearchParams()

  if (filters.leagueId) params.set('leagueId', filters.leagueId)

  const response = await fetch(
    `/api/prode/world-cup-groups${params.size ? `?${params.toString()}` : ''}`,
    { cache: 'no-store' }
  )
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error || 'No se pudieron cargar los grupos del Mundial.')
  }

  return (data.groups ?? []) as GroupStanding[]
}
