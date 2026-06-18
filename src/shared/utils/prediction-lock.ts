import { hasStartedStatus } from '@/shared/utils/match-status'

export const DEFAULT_PREDICTION_LOCK_MINUTES = 15
const ARGENTINA_UTC_OFFSET_HOURS = 3
export type PredictionLockOverride = 'locked' | 'unlocked'
export type PredictionLockOverrideValue = PredictionLockOverride | null

function hasExplicitTimezone(value: string) {
  return /(?:z|[+-]\d{2}:?\d{2})$/i.test(value.trim())
}

export function parseMatchDate(value: string | Date | null | undefined) {
  if (value instanceof Date) {
    return new Date(value.getTime())
  }

  if (typeof value !== 'string' || !value.trim()) {
    return new Date(Number.NaN)
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

export function normalizePredictionLockOverride(value: unknown): PredictionLockOverrideValue {
  if (value === 'locked' || value === 'unlocked') return value
  if (typeof value !== 'string') return null

  const normalized = value.trim().toLowerCase()

  if (normalized === 'locked' || normalized === 'bloqueado' || normalized === 'block') {
    return 'locked'
  }

  if (
    normalized === 'unlocked' ||
    normalized === 'desbloqueado' ||
    normalized === 'open'
  ) {
    return 'unlocked'
  }

  return null
}

export function getPredictionLockState(
  matchDate: string | Date | null | undefined,
  status = 'scheduled',
  now = new Date(),
  options: {
    lockMinutes?: number | null
    lockOverride?: unknown
  } = {}
) {
  const lockMinutes = Number.isFinite(options.lockMinutes)
    ? Number(options.lockMinutes)
    : DEFAULT_PREDICTION_LOCK_MINUTES
  const lockOverride = normalizePredictionLockOverride(options.lockOverride)
  const matchStart = parseMatchDate(matchDate)
  const matchStartMs = matchStart.getTime()
  const nowMs = now.getTime()
  const minutesUntilMatch = (matchStartMs - nowMs) / 60000
  const statusStarted = hasStartedStatus(status)
  const invalidDate = Number.isNaN(matchStartMs)
  const automaticLocked = invalidDate || statusStarted || minutesUntilMatch <= lockMinutes
  const locked =
    lockOverride === 'locked'
      ? true
      : lockOverride === 'unlocked' && !invalidDate
        ? false
        : automaticLocked

  return {
    locked,
    automaticLocked,
    lockOverride,
    invalidDate,
    matchStart,
    now,
    minutesUntilMatch,
    statusStarted,
    lockAt: new Date(matchStartMs - lockMinutes * 60000),
    lockMinutes,
  }
}

export function isPredictionLocked(
  matchDate: string | Date | null | undefined,
  status = 'scheduled',
  now = new Date(),
  options: {
    lockMinutes?: number | null
    lockOverride?: unknown
  } = {}
) {
  return getPredictionLockState(matchDate, status, now, options).locked
}

export function hasMatchStarted(
  matchDate: string | Date | null | undefined,
  status = 'scheduled',
  now = new Date()
) {
  const state = getPredictionLockState(matchDate, status, now)

  return state.invalidDate || state.statusStarted || state.minutesUntilMatch <= 0
}
