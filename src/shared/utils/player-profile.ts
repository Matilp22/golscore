function normalizeProfileMeasurement(value?: string | number | null) {
  if (value === null || value === undefined) return null

  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

export function formatPlayerHeight(value?: string | number | null) {
  const normalized = normalizeProfileMeasurement(value)
  if (!normalized) return null

  const lower = normalized.toLowerCase()
  const centimetersMatch = lower.match(/(\d{2,3})(?:[.,]\d+)?\s*cm\b/)
  if (centimetersMatch) {
    return `${(Number(centimetersMatch[1]) / 100).toFixed(2).replace('.', ',')} m`
  }

  const metersMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*m\b/)
  if (metersMatch) {
    const meters = Number(metersMatch[1].replace(',', '.'))
    return Number.isFinite(meters) ? `${meters.toFixed(2).replace('.', ',')} m` : normalized
  }

  const numeric = Number(lower.replace(',', '.').replace(/[^\d.]/g, ''))
  if (!Number.isFinite(numeric) || numeric <= 0) return normalized

  const meters = numeric > 3 ? numeric / 100 : numeric
  return `${meters.toFixed(2).replace('.', ',')} m`
}

export function formatPlayerWeight(value?: string | number | null) {
  const normalized = normalizeProfileMeasurement(value)
  if (!normalized) return null

  const lower = normalized.toLowerCase()
  const kilogramsMatch = lower.match(/(\d{2,3})(?:[.,]\d+)?\s*kg\b/)
  if (kilogramsMatch) return `${Number(kilogramsMatch[1])} kg`

  const numeric = Number(lower.replace(',', '.').replace(/[^\d.]/g, ''))
  if (!Number.isFinite(numeric) || numeric <= 0) return normalized

  return `${Math.round(numeric)} kg`
}
