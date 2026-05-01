export function formatEventMinute(
  minute?: number | null,
  extraMinute?: number | null
) {
  if (minute === null || minute === undefined) return '-'

  if (extraMinute !== null && extraMinute !== undefined && extraMinute > 0) {
    return `${minute}+${extraMinute}'`
  }

  return `${minute}'`
}
