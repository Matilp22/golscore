export function normalizeExternalId(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return null

  return String(value).trim()
}

export function getExternalIdVariants(value?: string | number | null) {
  const normalized = normalizeExternalId(value)

  if (!normalized) return []

  const numeric = Number(normalized)

  return Number.isFinite(numeric)
    ? [...new Set([normalized, numeric])]
    : [normalized]
}
