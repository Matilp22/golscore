import { normalizeRoundText } from '@/shared/utils/league-rounds'

export type UefaKnockoutPhaseKey =
  | 'playoffs'
  | 'roundOf16'
  | 'quarterFinals'
  | 'semiFinals'
  | 'final'

export type UefaRoundAudit = {
  normalized: UefaKnockoutPhaseKey | null
  includedInBracket: boolean
  reason: string
}

const UEFA_LEAGUE_PHASE_PATTERNS = [
  'league phase',
  'league stage',
  'fase liga',
  'group stage',
  'fase de grupos',
  'matchday',
  'regular season',
]

const UEFA_PRELIMINARY_PATTERNS = ['preliminary']
const UEFA_QUALIFYING_PATTERNS = ['qualifying', 'qualification', 'qualifiers']

function normalizeUefaRoundText(value: string | null | undefined) {
  return normalizeRoundText(value)
    .replace(/[-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isBarePlayoffRound(normalizedRound: string) {
  return (
    normalizedRound === 'play offs' ||
    normalizedRound === 'play off' ||
    normalizedRound === 'playoffs' ||
    normalizedRound === 'playoff' ||
    normalizedRound === 'play off round' ||
    normalizedRound === 'playoff round'
  )
}

export function getUefaKnockoutRoundLabel(phase: UefaKnockoutPhaseKey) {
  switch (phase) {
    case 'playoffs':
      return 'Playoffs'
    case 'roundOf16':
      return 'Octavos de final'
    case 'quarterFinals':
      return 'Cuartos de final'
    case 'semiFinals':
      return 'Semifinales'
    case 'final':
      return 'Final'
    default:
      return phase
  }
}

export function auditUefaKnockoutRound(round: string | null | undefined): UefaRoundAudit {
  const normalizedRound = normalizeUefaRoundText(round)

  if (!normalizedRound) {
    return {
      normalized: null,
      includedInBracket: false,
      reason: 'sin fase',
    }
  }

  if (UEFA_PRELIMINARY_PATTERNS.some((pattern) => normalizedRound.includes(pattern))) {
    return {
      normalized: null,
      includedInBracket: false,
      reason: 'preliminary round',
    }
  }

  if (UEFA_QUALIFYING_PATTERNS.some((pattern) => normalizedRound.includes(pattern))) {
    return {
      normalized: null,
      includedInBracket: false,
      reason: 'qualifying round',
    }
  }

  if (UEFA_LEAGUE_PHASE_PATTERNS.some((pattern) => normalizedRound.includes(pattern))) {
    return {
      normalized: null,
      includedInBracket: false,
      reason: 'league phase / group stage',
    }
  }

  if (
    normalizedRound.includes('knockout round play off') ||
    normalizedRound.includes('knockout round playoff') ||
    normalizedRound.includes('knockout phase play off') ||
    normalizedRound.includes('knockout phase playoff') ||
    normalizedRound.includes('playoff knockout round') ||
    normalizedRound.includes('play off knockout round') ||
    normalizedRound.includes('knockout playoff round') ||
    normalizedRound.includes('knockout play off round')
  ) {
    return {
      normalized: 'playoffs',
      includedInBracket: true,
      reason: 'knockout phase play-offs',
    }
  }

  if (
    normalizedRound.includes('round of 32') ||
    normalizedRound.includes('32nd finals') ||
    normalizedRound.includes('16th finals') ||
    normalizedRound.includes('1 16') ||
    normalizedRound.includes('1/16')
  ) {
    return {
      normalized: 'playoffs',
      includedInBracket: true,
      reason: 'api-football usa Round of 32 / 1-16 para los knockout play-offs',
    }
  }

  if (isBarePlayoffRound(normalizedRound)) {
    return {
      normalized: null,
      includedInBracket: false,
      reason: 'play-off ambiguo; en Champions/Europa corresponde a la clasificacion previa si no explicita knockout',
    }
  }

  if (
    normalizedRound.includes('round of 16') ||
    normalizedRound.includes('8th finals') ||
    normalizedRound.includes('octavo')
  ) {
    return {
      normalized: 'roundOf16',
      includedInBracket: true,
      reason: 'round of 16',
    }
  }

  if (normalizedRound.includes('quarter') || normalizedRound.includes('cuarto')) {
    return {
      normalized: 'quarterFinals',
      includedInBracket: true,
      reason: 'quarter-finals',
    }
  }

  if (normalizedRound.includes('semi')) {
    return {
      normalized: 'semiFinals',
      includedInBracket: true,
      reason: 'semi-finals',
    }
  }

  if (/\bfinal\b/.test(normalizedRound)) {
    return {
      normalized: 'final',
      includedInBracket: true,
      reason: 'final',
    }
  }

  return {
    normalized: null,
    includedInBracket: false,
    reason: 'fase no correspondiente al cuadro principal UEFA',
  }
}

export function normalizeUefaKnockoutRound(round: string | null | undefined) {
  return auditUefaKnockoutRound(round).normalized
}

export function isUefaLeaguePhaseRound(round: string | null | undefined) {
  const normalizedRound = normalizeUefaRoundText(round)

  if (!normalizedRound) return false

  return (
    UEFA_LEAGUE_PHASE_PATTERNS.some((pattern) => normalizedRound.includes(pattern)) ||
    /^\d+$/.test(normalizedRound)
  )
}

export function getUefaLeaguePhaseRoundNumber(round: string | null | undefined) {
  const normalizedRound = normalizeUefaRoundText(round)
  const match =
    normalizedRound.match(
      /\b(?:regular season|league phase|league stage|fase liga|fecha|round|jornada)\s*-\s*(\d+)\b/
    ) ??
    normalizedRound.match(
      /\b(?:regular season|league phase|league stage|fase liga|fecha|round|jornada)\s+(\d+)\b/
    ) ??
    normalizedRound.match(/\bmatchday\s+(\d+)\b/) ??
    normalizedRound.match(/^(\d+)$/)

  return match ? Number(match[1]) : null
}
