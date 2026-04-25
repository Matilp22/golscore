import {
  hasMatchStarted as hasMatchStartedByDate,
  isPredictionLocked as isPredictionLockedByDate,
} from '@/shared/utils/prediction-lock'

export type MatchResult = {
  homeScore: number
  awayScore: number
}

export type PredictionResult = {
  predictedHomeScore: number
  predictedAwayScore: number
}

export function isPredictionLocked(matchDate: string | Date, now = new Date()) {
  return isPredictionLockedByDate(matchDate, 'scheduled', now)
}

export function hasMatchStarted(
  matchDate: string | Date,
  status = 'scheduled',
  now = new Date()
) {
  return hasMatchStartedByDate(matchDate, status, now)
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
