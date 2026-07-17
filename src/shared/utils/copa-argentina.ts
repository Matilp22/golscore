import {
  getLeagueFinalPhaseKey,
  isThirdPlaceRound,
  normalizeRoundText,
} from '@/shared/utils/league-rounds'

export const COPA_ARGENTINA_STAGE_ORDER = ['r64', 'r32', 'r16', 'qf', 'sf', 'final'] as const

export type CopaArgentinaStageKey = (typeof COPA_ARGENTINA_STAGE_ORDER)[number]

export type CopaArgentinaParticipant = {
  team: string
  teamId?: string | number | null
  logo?: string | null
  goals: number | null
  isPlaceholder?: boolean
  isWinner?: boolean
}

export type CopaArgentinaMatchForWinner = {
  participants: readonly [CopaArgentinaParticipant, CopaArgentinaParticipant]
  homePenaltyScore?: number | null
  awayPenaltyScore?: number | null
}

export type CopaArgentinaRoundMatch = {
  round: string
  date?: string | null
  statusShort?: string | null
}

export function getCopaArgentinaStageKey(round: string): CopaArgentinaStageKey | null {
  const normalized = normalizeRoundText(round)
  const finalPhaseKey = getLeagueFinalPhaseKey(round)

  if (isThirdPlaceRound(round)) return null

  if (finalPhaseKey === 'final') return 'final'
  if (finalPhaseKey === 'semifinal') return 'sf'
  if (finalPhaseKey === 'cuartos') return 'qf'
  if (finalPhaseKey === 'octavos') return 'r16'

  if (normalized.includes('final') && !normalized.includes('semi')) return 'final'
  if (normalized.includes('semi')) return 'sf'
  if (normalized.includes('quarter') || normalized.includes('cuartos')) return 'qf'
  if (normalized.includes('octavos') || normalized.includes('round of 16') || normalized.includes('8th finals')) {
    return 'r16'
  }
  if (normalized.includes('round of 32') || normalized.includes('16th finals') || normalized.includes('dieciseisavos')) {
    return 'r32'
  }
  if (normalized.includes('round of 64') || normalized.includes('32nd finals') || normalized.includes('treintaidosavos')) {
    return 'r64'
  }

  return null
}

export function getCopaArgentinaStageLabel(stageKey: CopaArgentinaStageKey) {
  if (stageKey === 'r64') return '32AVOS DE FINAL'
  if (stageKey === 'r32') return '16AVOS DE FINAL'
  if (stageKey === 'r16') return 'OCTAVOS DE FINAL'
  if (stageKey === 'qf') return 'CUARTOS DE FINAL'
  if (stageKey === 'sf') return 'SEMIFINALES'
  return 'FINAL'
}

export function normalizeCopaArgentinaTeamName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getCopaArgentinaParticipantKey(
  participant: Pick<CopaArgentinaParticipant, 'team' | 'teamId'>
) {
  const teamId = participant.teamId

  if (teamId !== null && teamId !== undefined && String(teamId).trim()) {
    return `id:${teamId}`
  }

  return `name:${normalizeCopaArgentinaTeamName(participant.team)}`
}

export function getMatchWinner<TParticipant extends CopaArgentinaParticipant>(
  match: Omit<CopaArgentinaMatchForWinner, 'participants'> & {
    participants: readonly [TParticipant, TParticipant]
  }
): TParticipant | null {
  const [home, away] = match.participants

  if (
    home.goals !== null &&
    away.goals !== null &&
    home.goals !== away.goals
  ) {
    return home.goals > away.goals ? home : away
  }

  if (
    home.goals !== null &&
    away.goals !== null &&
    home.goals === away.goals &&
    match.homePenaltyScore !== null &&
    match.homePenaltyScore !== undefined &&
    match.awayPenaltyScore !== null &&
    match.awayPenaltyScore !== undefined &&
    match.homePenaltyScore !== match.awayPenaltyScore
  ) {
    return match.homePenaltyScore > match.awayPenaltyScore ? home : away
  }

  return null
}

export function getLatestActiveCopaArgentinaRound<T extends CopaArgentinaRoundMatch>(
  matches: T[]
) {
  const availableStageKeys = new Set<CopaArgentinaStageKey>()

  for (const match of matches) {
    const stageKey = getCopaArgentinaStageKey(match.round)
    if (stageKey) availableStageKeys.add(stageKey)
  }

  const latestStageKey = [...COPA_ARGENTINA_STAGE_ORDER]
    .reverse()
    .find((stageKey) => availableStageKeys.has(stageKey))

  if (!latestStageKey) return null

  return {
    key: latestStageKey,
    label: getCopaArgentinaStageLabel(latestStageKey),
  }
}
