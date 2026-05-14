const FINISHED_STATUSES = new Set([
  'ft',
  'aet',
  'pen',
  'final',
  'finalizado',
  'finalizada',
  'finished',
  'match finished',
  'cerrado',
])

const LIVE_STATUSES = new Set([
  'live',
  '1h',
  'ht',
  '2h',
  'et',
  'bt',
  'p',
  'first half',
  'second half',
  'extra time',
  'penalty in progress',
])

const UPCOMING_STATUSES = new Set([
  'ns',
  'tbd',
  'not started',
  'time to be defined',
])

const POSTPONED_STATUSES = new Set([
  'pst',
  'canc',
  'abd',
  'susp',
])

export function normalizeMatchStatus(status: string | null | undefined) {
  return (status ?? '').trim().toLowerCase()
}

export function isFinishedStatus(status: string | null | undefined) {
  const normalized = normalizeMatchStatus(status)

  return FINISHED_STATUSES.has(normalized) || normalized.includes('match finished')
}

export const isFinalMatchStatus = isFinishedStatus

export function isLiveStatus(status: string | null | undefined) {
  return LIVE_STATUSES.has(normalizeMatchStatus(status))
}

export function isUpcomingStatus(status: string | null | undefined) {
  return UPCOMING_STATUSES.has(normalizeMatchStatus(status))
}

export function isPostponedStatus(status: string | null | undefined) {
  return POSTPONED_STATUSES.has(normalizeMatchStatus(status))
}

export function isNotStartedOrInactiveStatus(status: string | null | undefined) {
  return isUpcomingStatus(status) || isPostponedStatus(status)
}

export function hasStartedStatus(status: string | null | undefined) {
  const normalized = normalizeMatchStatus(status)

  return isFinishedStatus(normalized) || isLiveStatus(normalized)
}

export function getCanonicalMatchStatusFromApi(status?: {
  short?: string | null
  long?: string | null
} | null) {
  const rawShort = status?.short?.trim()
  const normalizedShort = normalizeMatchStatus(rawShort)
  const normalizedLong = normalizeMatchStatus(status?.long)

  if (isFinishedStatus(normalizedShort) || isFinishedStatus(normalizedLong)) {
    if (normalizedShort === 'aet') return 'AET'
    if (normalizedShort === 'pen') return 'PEN'
    return 'FT'
  }

  return rawShort || status?.long?.trim() || 'NS'
}
