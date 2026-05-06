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

export type ImportantLiveEventKind = 'goal' | 'penalty' | 'red-card'

export function getImportantLiveEventKind(
  type?: string | null,
  detail?: string | null
): ImportantLiveEventKind | null {
  const normalizedType = normalizeFootballEventText(type)
  const normalizedDetail = normalizeFootballEventText(detail)

  if (isScoreboardGoalEvent(type, detail)) return 'goal'

  if (
    normalizedType.includes('card') &&
    (
      normalizedDetail.includes('red card') ||
      normalizedDetail === 'red' ||
      normalizedDetail.includes('roja')
    )
  ) {
    return 'red-card'
  }

  if (
    normalizedType.includes('penalty') ||
    normalizedDetail === 'penalty' ||
    normalizedDetail.includes('penalty confirmed') ||
    normalizedDetail.includes('penalty awarded') ||
    normalizedDetail.includes('penalty conceded') ||
    normalizedDetail.includes('penal') ||
    (
      normalizedType.includes('var') &&
      normalizedDetail.includes('penalty')
    )
  ) {
    return 'penalty'
  }

  return null
}

export function isImportantLiveEvent(
  type?: string | null,
  detail?: string | null
) {
  return Boolean(getImportantLiveEventKind(type, detail))
}
