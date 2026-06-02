type ScoreValue = number | string | null | undefined

export type ParsedHistoricalFinalScore = {
  goalsHome: number | null
  goalsAway: number | null
  homePenaltyScore: number | null
  awayPenaltyScore: number | null
}

function toNumber(value: ScoreValue) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseScorePair(value: string | null | undefined) {
  const match = (value ?? '').match(/(\d+)\s*-\s*(\d+)/)
  if (!match) return { home: null, away: null }

  return {
    home: Number(match[1]),
    away: Number(match[2]),
  }
}

export function formatMatchScoreWithPenalties(input: {
  goalsHome: ScoreValue
  goalsAway: ScoreValue
  homePenaltyScore?: ScoreValue
  awayPenaltyScore?: ScoreValue
  separator?: string
}) {
  const separator = input.separator ?? ' vs '
  const goalsHome = toNumber(input.goalsHome)
  const goalsAway = toNumber(input.goalsAway)
  const homePenaltyScore = toNumber(input.homePenaltyScore)
  const awayPenaltyScore = toNumber(input.awayPenaltyScore)
  const homeScore = goalsHome === null ? '-' : String(goalsHome)
  const awayScore = goalsAway === null ? '-' : String(goalsAway)
  const home = homePenaltyScore === null ? homeScore : `${homeScore} (${homePenaltyScore})`
  const away = awayPenaltyScore === null ? awayScore : `${awayScore} (${awayPenaltyScore})`

  return `${home}${separator}${away}`
}

export function parseHistoricalFinalScore(
  score: string | null | undefined,
  penalties?: string | null
): ParsedHistoricalFinalScore {
  const base = parseScorePair(score)
  const scorePenaltyMatch = (score ?? '').match(/\((\d+)\s*-\s*(\d+)\s*pen/i)
  const penaltiesPair = parseScorePair(penalties)

  return {
    goalsHome: base.home,
    goalsAway: base.away,
    homePenaltyScore: scorePenaltyMatch ? Number(scorePenaltyMatch[1]) : penaltiesPair.home,
    awayPenaltyScore: scorePenaltyMatch ? Number(scorePenaltyMatch[2]) : penaltiesPair.away,
  }
}
