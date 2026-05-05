const FINISHED_STATUSES = new Set([
  'ft',
  'aet',
  'pen',
  'final',
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
])

const UPCOMING_STATUSES = new Set([
  'ns',
  'tbd',
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
  return FINISHED_STATUSES.has(normalizeMatchStatus(status))
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
