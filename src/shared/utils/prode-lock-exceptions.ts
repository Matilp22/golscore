import { DEFAULT_PREDICTION_LOCK_MINUTES } from '@/shared/utils/prediction-lock'

const SWITZERLAND_BOSNIA_WORLD_CUP_MATCH_ID = 'c6610d47-1981-4aa4-9fd3-20ff20070262'
const SWITZERLAND_TEAM_ID = '6493df81-f83f-483c-beab-f2894bad6dd8'
const BOSNIA_TEAM_ID = '14771273-1bc9-41a4-9fbd-280f415bcb89'
const SWITZERLAND_BOSNIA_MATCH_DATE_PREFIX = '2026-06-18T16:00:00'

type ProdeLockMatchIdentity = {
  id?: string | number | null
  matchDate?: string | null
  homeTeamId?: string | number | null
  awayTeamId?: string | number | null
}

function sameId(a: string | number | null | undefined, b: string) {
  return String(a ?? '') === b
}

function isSwitzerlandBosniaWorldCupException(match: ProdeLockMatchIdentity) {
  if (sameId(match.id, SWITZERLAND_BOSNIA_WORLD_CUP_MATCH_ID)) {
    return true
  }

  const isSameFixtureTime = Boolean(
    match.matchDate?.startsWith(SWITZERLAND_BOSNIA_MATCH_DATE_PREFIX)
  )
  const isSameTeams =
    sameId(match.homeTeamId, SWITZERLAND_TEAM_ID) &&
    sameId(match.awayTeamId, BOSNIA_TEAM_ID)

  return isSameFixtureTime && isSameTeams
}

export function getPredictionLockMinutesForMatch(match: ProdeLockMatchIdentity) {
  if (isSwitzerlandBosniaWorldCupException(match)) {
    return 5
  }

  return DEFAULT_PREDICTION_LOCK_MINUTES
}
