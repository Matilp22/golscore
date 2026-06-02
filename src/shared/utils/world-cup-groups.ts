import {
  WORLD_CUP_EXTERNAL_ID,
  normalizeLeagueRound,
  normalizeRoundText,
} from '@/shared/utils/league-rounds'

export const WORLD_CUP_GROUP_KEYS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
] as const

export type WorldCupGroupKey = (typeof WORLD_CUP_GROUP_KEYS)[number]

const WORLD_CUP_GROUP_KEY_SET = new Set<string>(WORLD_CUP_GROUP_KEYS)

export function normalizeWorldCupText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getWorldCupGroupKey(value: string | null | undefined) {
  const normalized = normalizeWorldCupText(value)
  const match = normalized.match(/\b(?:group|grupo)\s+([a-l])\b/)
  const key = match?.[1]?.toUpperCase()

  return key && WORLD_CUP_GROUP_KEY_SET.has(key)
    ? (key as WorldCupGroupKey)
    : null
}

export function getWorldCupGroupLabel(group: string | null | undefined) {
  const key = getWorldCupGroupKey(group) ?? String(group ?? '').trim().toUpperCase()

  return WORLD_CUP_GROUP_KEY_SET.has(key) ? `Grupo ${key}` : 'Grupo'
}

export function sortWorldCupGroupKeys<T extends string>(groups: T[]) {
  return [...groups].sort((a, b) => {
    const indexA = WORLD_CUP_GROUP_KEYS.indexOf(a as WorldCupGroupKey)
    const indexB = WORLD_CUP_GROUP_KEYS.indexOf(b as WorldCupGroupKey)

    return (indexA < 0 ? 999 : indexA) - (indexB < 0 ? 999 : indexB)
  })
}

export function isWorldCupTournamentExternalId(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return false

  return Number(value) === WORLD_CUP_EXTERNAL_ID
}

export function isWorldCupGroupStageRound(
  round: string | number | null | undefined,
  leagueExternalId?: number | string | null
) {
  if (!isWorldCupTournamentExternalId(leagueExternalId)) return false

  const normalizedRound = normalizeLeagueRound(round, leagueExternalId)
  const normalizedText = normalizeRoundText(String(round ?? ''))

  return (
    Boolean(normalizedRound?.match(/^Group Stage - \d+$/i)) ||
    normalizedText.includes('group stage') ||
    normalizedText.includes('fase de grupos')
  )
}

export function getWorldCupGroupKeyFromRound(round: string | number | null | undefined) {
  return getWorldCupGroupKey(String(round ?? ''))
}
