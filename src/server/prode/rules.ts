export type MatchResult = {
  homeScore: number
  awayScore: number
}

export type PredictionResult = {
  predictedHomeScore: number
  predictedAwayScore: number
}

export function isPredictionLocked(matchDate: string | Date, now = new Date()) {
  const date = typeof matchDate === 'string' ? new Date(matchDate) : matchDate
  const lockAt = date.getTime() - 15 * 60 * 1000

  return now.getTime() >= lockAt
}

export function hasMatchStarted(
  matchDate: string | Date,
  status = 'scheduled',
  now = new Date()
) {
  const date = typeof matchDate === 'string' ? new Date(matchDate) : matchDate
  const normalizedStatus = status.toLowerCase()
  const startedStatuses = [
    'live',
    '1h',
    '2h',
    'ht',
    'et',
    'bt',
    'p',
    'ft',
    'aet',
    'pen',
    'final',
    'finished',
  ]

  return now.getTime() >= date.getTime() || startedStatuses.includes(normalizedStatus)
}

function outcome({ homeScore, awayScore }: MatchResult) {
  if (homeScore > awayScore) return 'home'
  if (homeScore < awayScore) return 'away'
  return 'draw'
}

export function calculatePredictionPoints(
  prediction: PredictionResult,
  result: MatchResult
) {
  const exact =
    prediction.predictedHomeScore === result.homeScore &&
    prediction.predictedAwayScore === result.awayScore

  if (exact) return 3

  const predictedOutcome = outcome({
    homeScore: prediction.predictedHomeScore,
    awayScore: prediction.predictedAwayScore,
  })

  return predictedOutcome === outcome(result) ? 1 : 0
}
