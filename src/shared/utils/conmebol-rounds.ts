import { normalizeRoundText } from '@/shared/utils/league-rounds'

export type ConmebolCompetitionType = 'libertadores' | 'sudamericana'

export type ConmebolPhaseKey =
  | 'groups'
  | 'playoffs'
  | 'roundOf16'
  | 'quarterFinals'
  | 'semiFinals'
  | 'final'

export type ConmebolRoundAudit = {
  normalized: ConmebolPhaseKey | null
  includedInBracket: boolean
  reason: string
}

const QUALIFYING_PATTERNS = [
  'qualifying',
  'qualification',
  'qualifiers',
  'preliminary',
  'preliminaries',
  'fase previa',
  'primera fase',
  'segunda fase',
  'tercera fase',
]

function normalizeConmebolRoundText(value: string | null | undefined) {
  return normalizeRoundText(value)
    .replace(/[-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isQualifyingRound(normalizedRound: string) {
  return QUALIFYING_PATTERNS.some((pattern) => normalizedRound.includes(pattern))
}

function isSudamericanaPlayoffRound(normalizedRound: string) {
  return (
    normalizedRound.includes('knockout round play off') ||
    normalizedRound.includes('knockout round playoff') ||
    normalizedRound.includes('knockout play off') ||
    normalizedRound.includes('knockout playoff') ||
    normalizedRound.includes('eliminatoria de octavos') ||
    normalizedRound.includes('playoffs de octavos') ||
    normalizedRound.includes('playoff de octavos') ||
    normalizedRound.includes('play offs') ||
    normalizedRound.includes('play off') ||
    normalizedRound.includes('playoffs') ||
    normalizedRound.includes('playoff')
  )
}

export function getConmebolPhaseLabel(phase: ConmebolPhaseKey) {
  switch (phase) {
    case 'groups':
      return 'Fase de grupos'
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

export function getConmebolPhaseOrder(competition: ConmebolCompetitionType) {
  return competition === 'sudamericana'
    ? ['groups', 'playoffs', 'roundOf16', 'quarterFinals', 'semiFinals', 'final'] as const
    : ['groups', 'roundOf16', 'quarterFinals', 'semiFinals', 'final'] as const
}

export function auditConmebolRound(
  round: string | null | undefined,
  competition: ConmebolCompetitionType
): ConmebolRoundAudit {
  const normalizedRound = normalizeConmebolRoundText(round)

  if (!normalizedRound) {
    return {
      normalized: null,
      includedInBracket: false,
      reason: 'sin fase',
    }
  }

  if (isQualifyingRound(normalizedRound)) {
    return {
      normalized: null,
      includedInBracket: false,
      reason: 'fase previa / clasificatoria',
    }
  }

  if (
    normalizedRound.includes('group stage') ||
    normalizedRound.includes('fase de grupos') ||
    /\bgroup\b/.test(normalizedRound) ||
    /\bgrupo\b/.test(normalizedRound)
  ) {
    return {
      normalized: 'groups',
      includedInBracket: false,
      reason: 'fase de grupos',
    }
  }

  if (competition === 'sudamericana' && isSudamericanaPlayoffRound(normalizedRound)) {
    return {
      normalized: 'playoffs',
      includedInBracket: true,
      reason: 'playoffs / eliminatoria de octavos',
    }
  }

  if (
    normalizedRound.includes('round of 16') ||
    normalizedRound.includes('8th finals') ||
    normalizedRound.includes('eighth finals') ||
    normalizedRound.includes('last 16') ||
    normalizedRound.includes('last sixteen') ||
    normalizedRound.includes('final stages round of 16') ||
    normalizedRound.includes('knockout stage round of 16') ||
    normalizedRound.includes('octavos')
  ) {
    return {
      normalized: 'roundOf16',
      includedInBracket: true,
      reason: 'octavos de final',
    }
  }

  if (
    normalizedRound.includes('quarter') ||
    normalizedRound.includes('4th finals') ||
    normalizedRound.includes('cuartos')
  ) {
    return {
      normalized: 'quarterFinals',
      includedInBracket: true,
      reason: 'cuartos de final',
    }
  }

  if (normalizedRound.includes('semi')) {
    return {
      normalized: 'semiFinals',
      includedInBracket: true,
      reason: 'semifinales',
    }
  }

  if (
    normalizedRound === 'final stages' ||
    normalizedRound === 'knockout stage' ||
    normalizedRound === 'final stage' ||
    normalizedRound === 'knockout'
  ) {
    return {
      normalized: null,
      includedInBracket: false,
      reason: 'contenedor generico sin fase concreta',
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
    reason: 'fase no correspondiente al cuadro Conmebol',
  }
}

export function normalizeConmebolRound(
  round: string | null | undefined,
  competition: ConmebolCompetitionType
) {
  return auditConmebolRound(round, competition).normalized
}

export function isConmebolGroupRound(round: string | null | undefined) {
  const normalizedRound = normalizeConmebolRoundText(round)

  return (
    normalizedRound.includes('group stage') ||
    normalizedRound.includes('fase de grupos') ||
    /\bgroup\b/.test(normalizedRound) ||
    /\bgrupo\b/.test(normalizedRound)
  )
}

export function isConmebolKnockoutRound(
  round: string | null | undefined,
  competition: ConmebolCompetitionType = 'libertadores'
) {
  return auditConmebolRound(round, competition).includedInBracket
}

export function getConmebolGroupRoundNumber(round: string | null | undefined) {
  const normalizedRound = normalizeConmebolRoundText(round)
  const match =
    normalizedRound.match(/\b(?:group stage|fase de grupos|fecha|round|jornada)\s*-\s*(\d+)\b/) ??
    normalizedRound.match(/\b(?:group stage|fase de grupos|fecha|round|jornada)\s+(\d+)\b/) ??
    normalizedRound.match(/\bmatchday\s+(\d+)\b/)

  if (!match) return null

  const value = Number(match[1])

  return Number.isFinite(value) ? value : null
}
