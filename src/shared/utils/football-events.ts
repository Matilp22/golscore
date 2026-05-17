export function normalizeFootballEventText(value?: string | null) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type FootballEventLike = {
  type?: string | null
  detail?: string | null
  comments?: string | null
  playerName?: string | null
  player_name?: string | null
  assistName?: string | null
  assist_name?: string | null
  player?: {
    name?: string | null
  } | null
  assist?: {
    name?: string | null
  } | null
}

function getEventType(event: FootballEventLike) {
  return event.type ?? null
}

function getEventDetail(event: FootballEventLike) {
  return event.detail ?? null
}

function getEventComments(event: FootballEventLike) {
  return event.comments ?? null
}

export function getEventPlayerName(event: FootballEventLike) {
  return (
    event.playerName ??
    event.player_name ??
    event.player?.name ??
    null
  )
}

export function getEventAssistName(event: FootballEventLike) {
  return (
    event.assistName ??
    event.assist_name ??
    event.assist?.name ??
    null
  )
}

function isCancelledEventText(
  type?: string | null,
  detail?: string | null,
  comments?: string | null
) {
  const normalizedDetail = normalizeFootballEventText(detail)
  const normalizedComments = normalizeFootballEventText(comments)
  const combined = [normalizeFootballEventText(type), normalizedDetail, normalizedComments]
    .filter(Boolean)
    .join(' ')

  return (
    combined.includes('cancelled') ||
    combined.includes('canceled') ||
    combined.includes('disallowed') ||
    combined.includes('anulado') ||
    combined.includes('anulada') ||
    combined.includes('annulled')
  )
}

export function isCancelledEvent(event: FootballEventLike) {
  return isCancelledEventText(
    getEventType(event),
    getEventDetail(event),
    getEventComments(event)
  )
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
    isCancelledEventText(type, detail) ||
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

export function isValidGoalForScorerTable(event: FootballEventLike) {
  return (
    isScoreboardGoalEvent(getEventType(event), getEventDetail(event)) &&
    getGoalKindFromDetail(getEventDetail(event)) !== 'own-goal'
  )
}

export function isValidAssistEvent(event: FootballEventLike) {
  const assistName = getEventAssistName(event)?.trim()
  const normalizedDetail = normalizeFootballEventText(getEventDetail(event))

  if (!assistName) return false
  if (!isValidGoalForScorerTable(event)) return false
  if (normalizedDetail.includes('penalty')) return false

  return (
    normalizedDetail === 'goal' ||
    normalizedDetail.includes('normal goal') ||
    !normalizedDetail
  )
}

export function isYellowCardEvent(event: FootballEventLike) {
  const normalizedType = normalizeFootballEventText(getEventType(event))
  const normalizedDetail = normalizeFootballEventText(getEventDetail(event))

  return (
    normalizedType.includes('card') &&
    normalizedDetail.includes('yellow') &&
    !normalizedDetail.includes('second yellow') &&
    !normalizedDetail.includes('red') &&
    !isCancelledEvent(event)
  )
}

export function isRedCardEvent(event: FootballEventLike) {
  const normalizedType = normalizeFootballEventText(getEventType(event))
  const normalizedDetail = normalizeFootballEventText(getEventDetail(event))

  return (
    normalizedType.includes('card') &&
    (
      normalizedDetail.includes('red') ||
      normalizedDetail.includes('second yellow') ||
      normalizedDetail.includes('roja')
    ) &&
    !isCancelledEvent(event)
  )
}

export type ImportantLiveEventKind = 'goal' | 'penalty' | 'red-card'

export function getImportantLiveEventKind(
  type?: string | null,
  detail?: string | null
): ImportantLiveEventKind | null {
  const normalizedType = normalizeFootballEventText(type)
  const normalizedDetail = normalizeFootballEventText(detail)

  if (isScoreboardGoalEvent(type, detail)) return 'goal'

  if (isRedCardEvent({ type, detail })) {
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

export function translateMatchEventDetail(
  type?: string | null,
  detail?: string | null,
  comments?: string | null
) {
  const normalizedType = normalizeFootballEventText(type)
  const normalizedDetail = normalizeFootballEventText(detail)
  const normalizedComments = normalizeFootballEventText(comments)
  const combined = [normalizedType, normalizedDetail, normalizedComments].filter(Boolean).join(' ')

  if (
    combined.includes('goal cancelled') ||
    combined.includes('goal canceled') ||
    combined.includes('goal disallowed') ||
    combined.includes('disallowed goal') ||
    combined.includes('gol anulado')
  ) {
    return 'Gol anulado'
  }

  if (
    combined.includes('red card cancelled') ||
    combined.includes('red card canceled') ||
    combined.includes('red cancelled') ||
    combined.includes('red canceled')
  ) {
    return 'Roja anulada'
  }

  if (
    combined.includes('yellow card cancelled') ||
    combined.includes('yellow card canceled') ||
    combined.includes('yellow cancelled') ||
    combined.includes('yellow canceled')
  ) {
    return 'Amarilla anulada'
  }

  if (
    combined.includes('card cancelled') ||
    combined.includes('card canceled')
  ) {
    return 'Tarjeta anulada'
  }

  if (combined.includes('penalty confirmed')) return 'Penal confirmado'
  if (
    combined.includes('penalty cancelled') ||
    combined.includes('penalty canceled')
  ) {
    return 'Penal anulado'
  }

  if (combined.includes('offside')) return 'Fuera de juego'
  if (combined.includes('substitution') || combined.includes('subst')) return 'Cambio'
  if (combined.includes('second yellow')) return 'Segunda amarilla'
  if (combined.includes('own goal')) return 'Gol en contra'
  if (combined.includes('normal goal')) return 'Gol'
  if (combined.includes('missed penalty') || combined.includes('penalty missed')) return 'Penal errado'
  if (normalizedType.includes('var') || normalizedDetail.includes('var') || normalizedComments.includes('var')) {
    return 'Revisión VAR'
  }

  return null
}
