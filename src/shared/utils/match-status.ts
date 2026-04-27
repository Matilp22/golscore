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

const NOT_STARTED_OR_INACTIVE_STATUSES = new Set([
  'ns',
  'tbd',
  'pst',
  'canc',
  'abd',
])

export function normalizeMatchStatus(status: string | null | undefined) {
  return (status ?? '').trim().toLowerCase()
}

export function isFinishedStatus(status: string | null | undefined) {
  return FINISHED_STATUSES.has(normalizeMatchStatus(status))
}

export function isLiveStatus(status: string | null | undefined) {
  return LIVE_STATUSES.has(normalizeMatchStatus(status))
}

export function isNotStartedOrInactiveStatus(status: string | null | undefined) {
  return NOT_STARTED_OR_INACTIVE_STATUSES.has(normalizeMatchStatus(status))
}

export function hasStartedStatus(status: string | null | undefined) {
  const normalized = normalizeMatchStatus(status)

  return isFinishedStatus(normalized) || isLiveStatus(normalized)
}
