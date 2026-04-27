import { hasStartedStatus } from '@/shared/utils/match-status'

const PREDICTION_LOCK_MINUTES = 15
const ARGENTINA_UTC_OFFSET_HOURS = 3

function hasExplicitTimezone(value: string) {
  return /(?:z|[+-]\d{2}:?\d{2})$/i.test(value.trim())
}

export function parseMatchDate(value: string | Date) {
  if (value instanceof Date) {
    return new Date(value.getTime())
  }

  if (hasExplicitTimezone(value)) {
    return new Date(value)
  }

  const match = value
    .trim()
    .match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?/
    )

  if (!match) {
    return new Date(value)
  }

  const [, year, month, day, hour = '0', minute = '0', second = '0', fraction = '0'] = match
  const milliseconds = Number(fraction.padEnd(3, '0').slice(0, 3))

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) + ARGENTINA_UTC_OFFSET_HOURS,
      Number(minute),
      Number(second),
      milliseconds
    )
  )
}

export function getPredictionLockState(
  matchDate: string | Date,
  status = 'scheduled',
  now = new Date()
) {
  const matchStart = parseMatchDate(matchDate)
  const matchStartMs = matchStart.getTime()
  const nowMs = now.getTime()
  const minutesUntilMatch = (matchStartMs - nowMs) / 60000
  const statusStarted = hasStartedStatus(status)
  const invalidDate = Number.isNaN(matchStartMs)
  const locked = invalidDate || statusStarted || minutesUntilMatch <= PREDICTION_LOCK_MINUTES

  return {
    locked,
    invalidDate,
    matchStart,
    now,
    minutesUntilMatch,
    statusStarted,
    lockAt: new Date(matchStartMs - PREDICTION_LOCK_MINUTES * 60000),
  }
}

export function isPredictionLocked(
  matchDate: string | Date,
  status = 'scheduled',
  now = new Date()
) {
  return getPredictionLockState(matchDate, status, now).locked
}

export function hasMatchStarted(
  matchDate: string | Date,
  status = 'scheduled',
  now = new Date()
) {
  const state = getPredictionLockState(matchDate, status, now)

  return state.invalidDate || state.statusStarted || state.minutesUntilMatch <= 0
}
