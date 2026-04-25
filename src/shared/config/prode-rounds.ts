const LIGA_PROFESIONAL_EXTERNAL_ID = 128
const WORLD_CUP_EXTERNAL_ID = 1

export const SHOW_CLAUSURA = false
import { parseMatchDate } from '@/shared/utils/prediction-lock'

const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000

export function normalizeProdeRound(
  round: string | null | undefined,
  leagueExternalId?: number | null
) {
  if (!round) return null

  const trimmedRound = round.trim()

  if (!trimmedRound) return null

  if (/^\d+$/.test(trimmedRound)) {
    if (leagueExternalId === WORLD_CUP_EXTERNAL_ID) {
      return `Group Stage - ${trimmedRound}`
    }

    return `Regular Season - ${trimmedRound}`
  }

  return trimmedRound
}

export function isVisibleProdeRound(
  round: string | null | undefined,
  leagueExternalId?: number | null
) {
  const normalizedRound = normalizeProdeRound(round, leagueExternalId)

  if (!normalizedRound) return false

  if (
    leagueExternalId === LIGA_PROFESIONAL_EXTERNAL_ID &&
    !SHOW_CLAUSURA &&
    /^Clausura - \d+$/i.test(normalizedRound)
  ) {
    return false
  }

  return true
}

export function getProdeRoundLabel(
  round: string | null | undefined,
  leagueExternalId?: number | null
) {
  const normalizedRound = normalizeProdeRound(round, leagueExternalId)

  if (!normalizedRound) return null

  const aperturaMatch = normalizedRound.match(/^Apertura - (\d+)$/i)
  const regularSeasonMatch = normalizedRound.match(/^Regular Season - (\d+)$/i)
  const clausuraMatch = normalizedRound.match(/^Clausura - (\d+)$/i)
  const groupStageMatch = normalizedRound.match(/^Group Stage - (\d+)$/i)
  const genericPhaseMatch = normalizedRound.match(/^(.+?) - (\d+)$/)

  if (aperturaMatch) return `Apertura - Fecha ${aperturaMatch[1]}`
  if (clausuraMatch) return `Clausura - Fecha ${clausuraMatch[1]}`
  if (groupStageMatch) return `Fase de grupos - Fecha ${groupStageMatch[1]}`

  if (regularSeasonMatch) {
    return leagueExternalId === LIGA_PROFESIONAL_EXTERNAL_ID
      ? `Apertura - Fecha ${regularSeasonMatch[1]}`
      : `Fecha ${regularSeasonMatch[1]}`
  }

  if (genericPhaseMatch) {
    return `${genericPhaseMatch[1]} - Fecha ${genericPhaseMatch[2]}`
  }

  return normalizedRound
}

type ProdeRoundMatch = {
  matchDate: string
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

  for (const match of matches) {
    const normalizedRound = normalizeProdeRound(match.round, match.league?.externalId)

    if (!normalizedRound || !isVisibleProdeRound(normalizedRound, match.league?.externalId)) {
      continue
    }

    const matchDateMs = parseMatchDate(match.matchDate).getTime()

    if (Number.isNaN(matchDateMs)) continue

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

  if (!entries.length) return null

  const openRound = entries
    .filter(([, summary]) => summary.hasOpenMatch)
    .sort((a, b) => a[1].earliestDateMs - b[1].earliestDateMs)[0]

  if (openRound) return openRound[0]

  return entries.sort((a, b) => a[1].distanceToNow - b[1].distanceToNow)[0]?.[0] ?? null
}
