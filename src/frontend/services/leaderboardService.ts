import type { LeaderboardRow } from '@/frontend/types/prode'

export async function getLeaderboard({
  leagueId,
  round,
}: {
  leagueId?: string | null
  round?: string | null
} = {}) {
  const params = new URLSearchParams()

  if (leagueId) params.set('leagueId', leagueId)
  if (round) params.set('round', round)

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
    userId?: string
    totalPoints?: number
    total_points?: number
    points?: number
    playedPredictions?: number
    played?: number
    exactPredictions?: number
    exact_predictions?: number
    exact_hits?: number
    partialPredictions?: number
    partial_predictions?: number
    partial_hits?: number
  }): LeaderboardRow => ({
    userId: row.userId ?? row.user_id,
    name: row.username || row.name || 'Usuario',
    points: row.totalPoints ?? row.total_points ?? row.points ?? 0,
    played: row.playedPredictions ?? row.played ?? 0,
    exactHits: row.exactPredictions ?? row.exact_predictions ?? row.exact_hits ?? 0,
    partialHits: row.partialPredictions ?? row.partial_predictions ?? row.partial_hits ?? 0,
  }))
}
