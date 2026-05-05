export function normalizeFootballEventText(value?: string | null) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isScoreboardGoalEvent(
  type?: string | null,
  detail?: string | null
) {
  const normalizedType = normalizeFootballEventText(type)
  const normalizedDetail = normalizeFootballEventText(detail)

  if (normalizedType !== 'goal') return false

  if (
    normalizedDetail.includes('missed') ||
    normalizedDetail.includes('shootout') ||
    normalizedDetail.includes('penalty shoot') ||
    normalizedDetail.includes('cancelled') ||
    normalizedDetail.includes('canceled') ||
    normalizedDetail.includes('var')
  ) {
    return false
  }

  if (!normalizedDetail) return true

  return (
    normalizedDetail === 'goal' ||
    normalizedDetail.includes('normal goal') ||
    normalizedDetail.includes('penalty') ||
    normalizedDetail.includes('own goal') ||
    normalizedDetail.includes('autogol') ||
    normalizedDetail.includes('en contra')
  )
}

export function getGoalKindFromDetail(detail?: string | null) {
  const normalizedDetail = normalizeFootballEventText(detail)

  if (
    normalizedDetail.includes('own goal') ||
    normalizedDetail.includes('autogol') ||
    normalizedDetail.includes('en contra')
  ) {
    return 'own-goal' as const
  }

  if (normalizedDetail.includes('penalty')) return 'penalty' as const

  return 'regular' as const
}
