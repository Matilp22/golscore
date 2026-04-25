export type ProdeMatch = {
  id: number
  matchDate: string
  status: string
  homeScore: number | null
  awayScore: number | null
  league: string
  homeTeam: string
  awayTeam: string
  homeLogo: string | null
  awayLogo: string | null
}

export type LeaderboardRow = {
  user_id: string
  name: string
  points: number
  played: number
  exact_hits: number
  partial_hits: number
}

export async function fetchProdeMatches() {
  const response = await fetch('/api/prode/matches', {
    cache: 'no-store',
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error || 'No se pudieron cargar los partidos.')
  }

  return data.matches as ProdeMatch[]
}

export async function fetchLeaderboard() {
  const response = await fetch('/api/prode/leaderboard', {
    cache: 'no-store',
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo cargar el ranking.')
  }

  return data.leaderboard as LeaderboardRow[]
}

export async function savePrediction(input: {
  matchId: string
  predictedHomeScore: number
  predictedAwayScore: number
}) {
  const response = await fetch('/api/prode/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo guardar la predicción.')
  }

  return data.prediction
}
