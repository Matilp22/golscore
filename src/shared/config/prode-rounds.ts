import {
  LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID,
  getLeagueFinalPhaseKey,
  getLeagueRoundLabel,
  getLeagueRoundSortValue,
  normalizeLeagueRound,
} from '@/shared/utils/league-rounds'
import { parseMatchDate } from '@/shared/utils/prediction-lock'

export const SHOW_CLAUSURA = false

const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000

export function normalizeProdeRound(
  round: string | null | undefined,
  leagueExternalId?: number | null
) {
  return normalizeLeagueRound(round, leagueExternalId)
}

export function isVisibleProdeRound(
  round: string | null | undefined,
  leagueExternalId?: number | null
) {
  const normalizedRound = normalizeProdeRound(round, leagueExternalId)

  if (!normalizedRound) return false

  if (
    leagueExternalId === LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID &&
    !SHOW_CLAUSURA &&
    /^clausura-fecha-\d+$/i.test(normalizedRound)
  ) {
    return false
  }

  return true
}

export function getProdeRoundLabel(
  round: string | null | undefined,
  leagueExternalId?: number | null
) {
  return getLeagueRoundLabel(round, leagueExternalId)
}

export function getProdeRoundSortValue(
  round: string | null | undefined,
  leagueExternalId?: number | null
) {
  return getLeagueRoundSortValue(round, leagueExternalId)
}

type ProdeRoundMatch = {
  matchDate: string | null
  round: string | null
  league?: {
    externalId?: number | null
  } | null
}

export function getCurrentProdeRound(matches: ProdeRoundMatch[], now = new Date()) {
  const nowMs = now.getTime()
  const roundSummaries = new Map<
    string,
    { earliestDateMs: number; hasOpenMatch: boolean; distanceToNow: number }
  >()
  const unscheduledLigaProfesionalFinalPhases = new Set<string>()

  for (const match of matches) {
    const leagueExternalId = match.league?.externalId
    const normalizedRound = normalizeProdeRound(match.round, leagueExternalId)

    if (!normalizedRound || !isVisibleProdeRound(normalizedRound, leagueExternalId)) {
      continue
    }

    const matchDateMs = parseMatchDate(match.matchDate).getTime()

    if (Number.isNaN(matchDateMs)) {
      if (
        leagueExternalId === LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID &&
        getLeagueFinalPhaseKey(normalizedRound)
      ) {
        unscheduledLigaProfesionalFinalPhases.add(normalizedRound)
      }

      continue
    }

    const existingSummary = roundSummaries.get(normalizedRound)
    const isOpenMatch = matchDateMs - FIFTEEN_MINUTES_IN_MS > nowMs
    const distanceToNow = Math.abs(matchDateMs - nowMs)

    if (!existingSummary) {
      roundSummaries.set(normalizedRound, {
        earliestDateMs: matchDateMs,
        hasOpenMatch: isOpenMatch,
        distanceToNow,
      })
      continue
    }

    existingSummary.earliestDateMs = Math.min(existingSummary.earliestDateMs, matchDateMs)
    existingSummary.hasOpenMatch = existingSummary.hasOpenMatch || isOpenMatch
    existingSummary.distanceToNow = Math.min(existingSummary.distanceToNow, distanceToNow)
  }

  const entries = [...roundSummaries.entries()]

  if (unscheduledLigaProfesionalFinalPhases.size) {
    return [...unscheduledLigaProfesionalFinalPhases].sort(
      (a, b) =>
        getProdeRoundSortValue(a, LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID) -
        getProdeRoundSortValue(b, LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID)
    )[0] ?? null
  }

  if (!entries.length) return null

  const openRound = entries
    .filter(([, summary]) => summary.hasOpenMatch)
    .sort((a, b) => a[1].earliestDateMs - b[1].earliestDateMs)[0]

  if (openRound) return openRound[0]

  return entries.sort((a, b) => a[1].distanceToNow - b[1].distanceToNow)[0]?.[0] ?? null
}
