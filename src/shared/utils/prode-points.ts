export type PredictionPointsInput = {
  predictedHomeScore: number
  predictedAwayScore: number
  realHomeScore: number
  realAwayScore: number
}

export type PredictionPointsResult = {
  points: number
  exact_hit: boolean
  partial_hit: boolean
  is_exact: boolean
  is_partial: boolean
}

function getOutcome(homeScore: number, awayScore: number) {
  return Math.sign(homeScore - awayScore)
}

export function calculatePredictionPoints({
  predictedHomeScore,
  predictedAwayScore,
  realHomeScore,
  realAwayScore,
}: PredictionPointsInput): PredictionPointsResult {
  const exactHit =
    predictedHomeScore === realHomeScore &&
    predictedAwayScore === realAwayScore
  const partialHit =
    !exactHit &&
    getOutcome(predictedHomeScore, predictedAwayScore) ===
      getOutcome(realHomeScore, realAwayScore)

  return {
    points: exactHit ? 3 : partialHit ? 1 : 0,
    exact_hit: exactHit,
    partial_hit: partialHit,
    is_exact: exactHit,
    is_partial: partialHit,
  }
}
