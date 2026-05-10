export const LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID = 128
export const WORLD_CUP_EXTERNAL_ID = 1

export type LeagueFinalPhaseKey = 'octavos' | 'cuartos' | 'semifinal' | 'final'

const FINAL_PHASE_LABELS: Record<LeagueFinalPhaseKey, string> = {
  octavos: 'Octavos de final',
  cuartos: 'Cuartos de final',
  semifinal: 'Semifinal',
  final: 'Final',
}

const FINAL_PHASE_SORT_VALUES: Record<LeagueFinalPhaseKey, number> = {
  octavos: 1000,
  cuartos: 1010,
  semifinal: 1020,
  final: 1030,
}

export function normalizeRoundText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getLeagueExternalIdValue(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return null

  const numericValue = Number(value)

  return Number.isFinite(numericValue) ? numericValue : null
}

function getRoundNumberFromNormalizedText(normalizedRound: string) {
  const match =
    normalizedRound.match(/\b(?:regular season|apertura|clausura|fecha|round)\s*-\s*(\d+)\b/) ??
    normalizedRound.match(/\b(?:regular season|apertura|clausura|fecha|round)\s+(\d+)\b/) ??
    normalizedRound.match(/^(\d+)$/)

  if (!match) return null

  const numberValue = Number(match[1])

  return Number.isFinite(numberValue) ? numberValue : null
}

export function getLeagueFinalPhaseKey(
  round: string | null | undefined
): LeagueFinalPhaseKey | null {
  const normalizedRound = normalizeRoundText(round)

  if (!normalizedRound) return null

  if (
    /\b(round of 16|8th finals?|octavos?)\b/.test(normalizedRound)
  ) {
    return 'octavos'
  }

  if (
    /\b(quarter finals?|quarter-finals?|cuartos?)\b/.test(normalizedRound)
  ) {
    return 'cuartos'
  }

  if (
    /\b(semi finals?|semi-finals?|semifinal(?:es)?)\b/.test(normalizedRound)
  ) {
    return 'semifinal'
  }

  if (/\bfinal\b/.test(normalizedRound) && !/\bsemi/.test(normalizedRound)) {
    return 'final'
  }

  return null
}

export function isLeagueFinalPhaseRound(
  round: string | null | undefined,
  _leagueExternalId?: number | string | null
) {
  void _leagueExternalId

  return Boolean(getLeagueFinalPhaseKey(round))
}

export function isLigaProfesionalKnockoutRound(round: string | null | undefined) {
  return Boolean(getLeagueFinalPhaseKey(round))
}

export function isLigaProfesionalRegularSeasonRound(round: string | null | undefined) {
  const normalizedRound = normalizeRoundText(round)

  if (!normalizedRound) return false
  if (isLigaProfesionalKnockoutRound(normalizedRound)) return false

  return (
    /\bregular season\s*-?\s*\d+\b/.test(normalizedRound) ||
    /\bfecha\s*-?\s*\d+\b/.test(normalizedRound) ||
    /\b(?:apertura|clausura)\s*-?\s*\d+\b/.test(normalizedRound) ||
    /\b(?:apertura|clausura)\s+fecha\s*-?\s*\d+\b/.test(normalizedRound) ||
    /\bround\s*-?\s*\d+\b/.test(normalizedRound) ||
    /^\d+$/.test(normalizedRound)
  )
}

export function normalizeLeagueRound(
  round: string | number | null | undefined,
  leagueExternalId?: number | string | null
) {
  if (round === null || round === undefined) return null

  const trimmedRound = String(round).trim()

  if (!trimmedRound) return null

  const leagueId = getLeagueExternalIdValue(leagueExternalId)
  const normalizedRound = normalizeRoundText(trimmedRound)
  const finalPhaseKey = getLeagueFinalPhaseKey(trimmedRound)

  if (finalPhaseKey) return finalPhaseKey

  const roundNumber = getRoundNumberFromNormalizedText(normalizedRound)

  if (leagueId === LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID) {
    if (roundNumber !== null) {
      if (normalizedRound.includes('clausura')) return `clausura-fecha-${roundNumber}`

      return `apertura-fecha-${roundNumber}`
    }

    return trimmedRound
  }

  if (/^\d+$/.test(trimmedRound)) {
    if (leagueId === WORLD_CUP_EXTERNAL_ID) {
      return `Group Stage - ${trimmedRound}`
    }

    return `Regular Season - ${trimmedRound}`
  }

  return trimmedRound
}

export function getLeagueRoundLabel(
  round: string | number | null | undefined,
  leagueExternalId?: number | string | null
) {
  const normalizedRound = normalizeLeagueRound(round, leagueExternalId)
  const leagueId = getLeagueExternalIdValue(leagueExternalId)

  if (!normalizedRound) return null

  const finalPhaseKey = getLeagueFinalPhaseKey(normalizedRound)

  if (finalPhaseKey) {
    return leagueId === LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID
      ? `${FINAL_PHASE_LABELS[finalPhaseKey]} - Apertura`
      : FINAL_PHASE_LABELS[finalPhaseKey]
  }

  const aperturaMatch = normalizedRound.match(/^apertura-fecha-(\d+)$/i)
  const clausuraSlugMatch = normalizedRound.match(/^clausura-fecha-(\d+)$/i)
  const aperturaRawMatch = String(round ?? '').trim().match(/^Apertura - (\d+)$/i)
  const regularSeasonMatch = String(round ?? '').trim().match(/^Regular Season - (\d+)$/i)
  const clausuraRawMatch = String(round ?? '').trim().match(/^Clausura - (\d+)$/i)
  const groupStageMatch = normalizedRound.match(/^Group Stage - (\d+)$/i)
  const genericPhaseMatch = normalizedRound.match(/^(.+?) - (\d+)$/)

  if (aperturaMatch) return `Fecha ${aperturaMatch[1]} - Apertura`
  if (clausuraSlugMatch) return `Fecha ${clausuraSlugMatch[1]} - Clausura`
  if (aperturaRawMatch) return `Fecha ${aperturaRawMatch[1]} - Apertura`
  if (clausuraRawMatch) return `Fecha ${clausuraRawMatch[1]} - Clausura`
  if (groupStageMatch) return `Fase de grupos - Fecha ${groupStageMatch[1]}`

  if (regularSeasonMatch) {
    return leagueId === LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID
      ? `Fecha ${regularSeasonMatch[1]} - Apertura`
      : `Fecha ${regularSeasonMatch[1]}`
  }

  if (genericPhaseMatch) {
    return `${genericPhaseMatch[1]} - Fecha ${genericPhaseMatch[2]}`
  }

  return normalizedRound
}

export function getLeagueRoundSortValue(
  round: string | number | null | undefined,
  leagueExternalId?: number | string | null
) {
  const normalizedRound = normalizeLeagueRound(round, leagueExternalId)

  if (!normalizedRound) return Number.MAX_SAFE_INTEGER

  const finalPhaseKey = getLeagueFinalPhaseKey(normalizedRound)

  if (finalPhaseKey) return FINAL_PHASE_SORT_VALUES[finalPhaseKey]

  const aperturaMatch = normalizedRound.match(/^apertura-fecha-(\d+)$/i)
  const clausuraMatch = normalizedRound.match(/^clausura-fecha-(\d+)$/i)
  const regularSeasonMatch = normalizedRound.match(/^Regular Season - (\d+)$/i)
  const groupStageMatch = normalizedRound.match(/^Group Stage - (\d+)$/i)
  const genericPhaseMatch = normalizedRound.match(/^(.+?) - (\d+)$/)

  if (aperturaMatch) return Number(aperturaMatch[1])
  if (regularSeasonMatch) return Number(regularSeasonMatch[1])
  if (groupStageMatch) return Number(groupStageMatch[1])
  if (clausuraMatch) return 500 + Number(clausuraMatch[1])
  if (genericPhaseMatch) return 700 + Number(genericPhaseMatch[2])

  return 900
}
