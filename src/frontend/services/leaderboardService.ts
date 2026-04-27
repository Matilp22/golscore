import type { LeaderboardRow } from '@/frontend/types/prode'

export async function getLeaderboard({ leagueId }: { leagueId?: string | null } = {}) {
  const params = new URLSearchParams()

  if (leagueId) params.set('leagueId', leagueId)

  const query = params.toString()
  const response = await fetch(`/api/prode/leaderboard${query ? `?${query}` : ''}`, {
    cache: 'no-store',
  })
  const data = await response.json()

  if (!response.ok) {
    return []
  }

  return (data.leaderboard ?? []).map((row: {
    user_id: string
    username?: string
    name?: string
    total_points?: number
    points?: number
    played?: number
    exact_predictions?: number
    exact_hits?: number
    partial_predictions?: number
    partial_hits?: number
  }): LeaderboardRow => ({
    userId: row.user_id,
    name: row.username || row.name || 'Usuario',
    points: row.total_points ?? row.points ?? 0,
    played: row.played ?? 0,
    exactHits: row.exact_predictions ?? row.exact_hits ?? 0,
    partialHits: row.partial_predictions ?? row.partial_hits ?? 0,
  }))
}
