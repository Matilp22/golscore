import type { LeaderboardRow } from '@/frontend/types/prode'

export async function getLeaderboard() {
  const response = await fetch('/api/prode/leaderboard', {
    cache: 'no-store',
  })
  const data = await response.json()

  if (!response.ok) {
    return []
  }

  return (data.leaderboard ?? []).map((row: {
    user_id: string
    name: string
    points: number
    played: number
    exact_hits: number
    partial_hits: number
  }): LeaderboardRow => ({
    userId: row.user_id,
    name: row.name,
    points: row.points,
    played: row.played,
    exactHits: row.exact_hits,
    partialHits: row.partial_hits,
  }))
}
