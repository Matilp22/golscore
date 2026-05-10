type FixtureStatusMinuteInput = {
  elapsed?: number | null
  extra?: number | null
}

export function getFixtureStatusElapsedMinute(status?: FixtureStatusMinuteInput | null) {
  const elapsed = status?.elapsed
  const extra = status?.extra

  if (elapsed === null || elapsed === undefined) return null
  if (!Number.isFinite(elapsed)) return null

  if (extra !== null && extra !== undefined && Number.isFinite(extra) && extra > 0) {
    return elapsed + extra
  }

  return elapsed
}

export function getEventElapsedMinute(
  minute?: number | null,
  extraMinute?: number | null
) {
  if (minute === null || minute === undefined || !Number.isFinite(minute)) return null

  if (
    extraMinute !== null &&
    extraMinute !== undefined &&
    Number.isFinite(extraMinute) &&
    extraMinute > 0
  ) {
    return minute + extraMinute
  }

  return minute
}

