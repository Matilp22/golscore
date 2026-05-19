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
    id?: number | null
    name?: string | null
  } | null
  assist?: {
    id?: number | null
    name?: string | null
  } | null
  time?: {
    elapsed?: number | null
    extra?: number | null
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

function eventText(
  type?: string | null,
  detail?: string | null,
  comments?: string | null
) {
  return [type, detail, comments]
    .map(normalizeFootballEventText)
    .filter(Boolean)
    .join(' ')
}

function isCancelledEventText(
  type?: string | null,
  detail?: string | null,
  comments?: string | null
) {
  const normalizedDetail = normalizeFootballEventText(detail)
  const normalizedComments = normalizeFootballEventText(comments)
  const combined = eventText(type, normalizedDetail, normalizedComments)

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

export function isMissedPenaltyEvent(event: FootballEventLike) {
  const combined = eventText(
    getEventType(event),
    getEventDetail(event),
    getEventComments(event)
  )

  return (
    combined.includes('missed penalty') ||
    combined.includes('penalty missed') ||
    combined.includes('penalty saved') ||
    combined.includes('saved penalty') ||
    combined.includes('penalty fail') ||
    combined.includes('penalty failed') ||
    combined.includes('failed penalty') ||
    combined.includes('penal errado') ||
    combined.includes('penal fallado') ||
    combined.includes('penal atajado')
  )
}

export function isSubstitutionEvent(event: FootballEventLike) {
  const combined = eventText(
    getEventType(event),
    getEventDetail(event),
    getEventComments(event)
  )

  return (
    combined.includes('substitution') ||
    combined.includes('subst') ||
    combined.includes('cambio')
  )
}

export function isVarEvent(event: FootballEventLike) {
  const combined = eventText(
    getEventType(event),
    getEventDetail(event),
    getEventComments(event)
  )

  return (
    combined.includes('var') ||
    combined.includes('goal cancelled') ||
    combined.includes('goal canceled') ||
    combined.includes('goal disallowed') ||
    combined.includes('disallowed goal') ||
    combined.includes('card cancelled') ||
    combined.includes('card canceled') ||
    combined.includes('penalty confirmed') ||
    combined.includes('penalty cancelled') ||
    combined.includes('penalty canceled')
  )
}

export function isInjuryEvent(event: FootballEventLike) {
  const combined = eventText(
    getEventType(event),
    getEventDetail(event),
    getEventComments(event)
  )

  return (
    combined.includes('injury') ||
    combined.includes('lesion') ||
    combined.includes('lesionado')
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
    isMissedPenaltyEvent({ type, detail }) ||
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
  const combined = eventText(normalizedType, normalizedDetail, normalizedComments)

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
  if (isMissedPenaltyEvent({ type, detail, comments })) return 'Penal errado'
  if (combined.includes('injury')) return 'Lesion'
  if (normalizedType.includes('var') || normalizedDetail.includes('var') || normalizedComments.includes('var')) {
    return 'Revisión VAR'
  }

  return null
}

export type NormalizedMatchEventKind =
  | 'goal'
  | 'penalty'
  | 'penalty-goal'
  | 'penalty-missed'
  | 'own-goal'
  | 'yellow-card'
  | 'red-card'
  | 'second-yellow'
  | 'substitution'
  | 'var'
  | 'injury'
  | 'event'

export function normalizeMatchEvent(event: FootballEventLike) {
  const type = normalizeFootballEventText(getEventType(event))
  const detail = normalizeFootballEventText(getEventDetail(event))
  const comments = normalizeFootballEventText(getEventComments(event))
  const combined = eventText(type, detail, comments)

  let kind: NormalizedMatchEventKind = 'event'

  if (isSubstitutionEvent(event)) kind = 'substitution'
  else if (isMissedPenaltyEvent(event)) kind = 'penalty-missed'
  else if (isVarEvent(event)) kind = 'var'
  else if (isInjuryEvent(event)) kind = 'injury'
  else if (detail.includes('second yellow')) kind = 'second-yellow'
  else if (detail.includes('red') || detail.includes('roja')) kind = 'red-card'
  else if (detail.includes('yellow') || detail.includes('amarilla')) kind = 'yellow-card'
  else if (type.includes('goal') && detail.includes('own goal')) kind = 'own-goal'
  else if (type.includes('goal') && detail.includes('penalty')) kind = 'penalty-goal'
  else if (type.includes('penalty') || detail.includes('penalty') || comments.includes('penalty')) kind = 'penalty'
  else if (type.includes('goal')) kind = 'goal'

  return {
    kind,
    label:
      translateMatchEventDetail(
        getEventType(event),
        getEventDetail(event),
        getEventComments(event)
      ) ||
      getEventDetail(event) ||
      getEventType(event) ||
      'Evento',
    playerName: getEventPlayerName(event),
    assistName: getEventAssistName(event),
    minute: event.time?.elapsed ?? null,
    extraMinute: event.time?.extra ?? null,
    isGoalForScoreboard: isScoreboardGoalEvent(getEventType(event), getEventDetail(event)),
    isMissedPenalty: kind === 'penalty-missed',
    isSubstitution: kind === 'substitution',
    isVar: kind === 'var',
    isCard:
      kind === 'yellow-card' ||
      kind === 'red-card' ||
      kind === 'second-yellow',
    rawText: combined,
  }
}

function normalizePlayerRef(value?: string | null) {
  return normalizeFootballEventText(value)
}

export function getPlayerIncidentsForLineup(
  player: { id?: number | null; name?: string | null },
  events: FootballEventLike[]
) {
  const playerName = normalizePlayerRef(player.name)

  return events
    .filter((event) => {
      const eventPlayerId = event.player?.id
      if (player.id && eventPlayerId && Number(player.id) === Number(eventPlayerId)) return true

      const eventPlayerName = normalizePlayerRef(getEventPlayerName(event))
      const eventAssistName = normalizePlayerRef(getEventAssistName(event))

      return Boolean(
        playerName &&
        (eventPlayerName === playerName || eventAssistName === playerName)
      )
    })
    .map(normalizeMatchEvent)
}
