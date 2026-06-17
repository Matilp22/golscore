export { formatEventMinute } from '@/shared/utils/event-minute'

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
  id?: string | number | null
  external_event_id?: string | number | null
  match_id?: string | number | null
  team_id?: string | number | null
  player_id?: string | number | null
  player_external_id?: string | number | null
  assist_id?: string | number | null
  assist_external_id?: string | number | null
  type?: string | null
  detail?: string | null
  comments?: string | null
  minute?: number | null
  extra_minute?: number | null
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
  team?: {
    id?: number | string | null
    name?: string | null
  } | null
  time?: {
    elapsed?: number | null
    extra?: number | null
  } | null
}

type PlayerRef = {
  id?: number | string | null
  name?: string | null
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

function getEventExternalId(event: FootballEventLike) {
  return event.external_event_id ?? null
}

export function getEventTeamId(event: FootballEventLike) {
  return event.team?.id ?? event.team_id ?? null
}

export function getEventMinute(event: FootballEventLike) {
  return event.time?.elapsed ?? event.minute ?? null
}

export function getEventExtraMinute(event: FootballEventLike) {
  return event.time?.extra ?? event.extra_minute ?? null
}

export function getEventPlayerId(event: FootballEventLike) {
  return (
    event.player?.id ??
    event.player_external_id ??
    event.player_id ??
    null
  )
}

export function getEventAssistId(event: FootballEventLike) {
  return (
    event.assist?.id ??
    event.assist_external_id ??
    event.assist_id ??
    null
  )
}

function normalizeId(value?: string | number | null) {
  if (value === null || value === undefined) return ''

  return String(value).trim()
}

function sameEventTeam(event: FootballEventLike, teamId?: string | number | null) {
  const eventTeamId = getEventTeamId(event)

  if (teamId === null || teamId === undefined || teamId === '') return false
  if (eventTeamId === null || eventTeamId === undefined || eventTeamId === '') return false

  return normalizeId(eventTeamId) === normalizeId(teamId)
}

function playerMatchesRef(player: PlayerRef | null | undefined, refs?: PlayerRef[]) {
  if (!player || !refs?.length) return false
  const playerId = normalizeId(player.id)
  const playerName = normalizeFootballEventText(player.name)

  return refs.some((ref) => {
    const refId = normalizeId(ref.id)
    if (playerId && refId && playerId === refId) return true

    return Boolean(playerName && normalizeFootballEventText(ref.name) === playerName)
  })
}

function playerMatchesMainEvent(
  player: PlayerRef,
  event: FootballEventLike,
  teamId?: string | number | null,
  options: {
    requireTeam?: boolean
  } = {}
) {
  const requireTeam = options.requireTeam ?? true
  if (requireTeam && !sameEventTeam(event, teamId)) return false

  const lineupPlayerId = normalizeId(player.id)
  const eventPlayerId = normalizeId(getEventPlayerId(event))

  if (lineupPlayerId && eventPlayerId) {
    return lineupPlayerId === eventPlayerId
  }

  const lineupPlayerName = normalizeFootballEventText(player.name)
  const eventPlayerName = normalizeFootballEventText(getEventPlayerName(event))

  if (lineupPlayerName && eventPlayerName && lineupPlayerName === eventPlayerName) return true

  const lineupPlayerRef = normalizePersonDisplayRef(player.name)
  const eventPlayerRef = normalizePersonDisplayRef(getEventPlayerName(event))

  return Boolean(lineupPlayerRef && eventPlayerRef && lineupPlayerRef === eventPlayerRef)
}

function formatEventKeyExtra(value: unknown) {
  if (value === null || value === undefined || value === 0 || value === '0') {
    return 'no-extra'
  }

  return value
}

function normalizePersonDisplayRef(value?: string | null) {
  const normalized = normalizeFootballEventText(value)
  if (!normalized) return ''

  const parts = normalized.split(' ').filter(Boolean)
  if (parts.length < 2) return normalized

  const firstInitial = parts[0]?.[0] ?? ''
  const lastName = parts[parts.length - 1]

  return firstInitial && lastName ? `${firstInitial}-${lastName}` : normalized
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

export function isPenaltyShootoutEvent(event: FootballEventLike) {
  const combined = eventText(
    getEventType(event),
    getEventDetail(event),
    getEventComments(event)
  )
  const elapsed = getEventMinute(event) ?? 0
  const extra = getEventExtraMinute(event) ?? 0

  return (
    combined.includes('penalty shootout') ||
    combined.includes('shootout') ||
    combined.includes('penales') ||
    (elapsed >= 120 && extra > 0 && combined.includes('penalty'))
  )
}

export function formatMatchEventStableKey(
  event: FootballEventLike & {
    team?: {
      id?: number | string | null
      name?: string | null
    } | null
  },
  matchId?: string | number | null
) {
  const externalEventId = getEventExternalId(event)

  if (externalEventId !== null && externalEventId !== undefined && String(externalEventId).trim()) {
    return [
      matchId ?? event.match_id ?? 'match',
      'external',
      externalEventId,
    ].map((part) =>
      String(part)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'none'
    ).join(':')
  }

  return [
    matchId ?? event.match_id ?? 'match',
    getEventType(event) ?? 'type',
    getEventDetail(event) ?? 'detail',
    getEventMinute(event) ?? 'minute',
    formatEventKeyExtra(getEventExtraMinute(event)),
    getEventTeamId(event) ?? event.team?.name ?? 'team',
    getEventPlayerName(event) ?? 'player',
    getEventAssistName(event) ?? 'assist',
    getEventComments(event) ?? 'comments',
  ].map((part) =>
    String(part)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'none'
  ).join(':')
}

export const getMatchEventDedupeKey = formatMatchEventStableKey

function startsWithUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    .test(value)
}

export function getMatchEventExternalIdPriority(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return 0

  if (!text.includes(':')) return 4
  if (/^\d+:/.test(text)) return 3
  if (startsWithUuid(text)) return 1

  return 2
}

export function formatMatchEventSemanticKey(
  event: FootballEventLike,
  matchId?: string | number | null
) {
  if (isPenaltyShootoutEvent(event)) {
    return formatMatchEventStableKey(event, matchId)
  }

  const displayDetail = isSubstitutionEvent(event)
    ? 'substitution'
    : isVarEvent(event) || isCancelledEvent(event)
      ? [getEventDetail(event), getEventComments(event)].filter(Boolean).join(':') || 'var'
    : getEventDetail(event) ?? 'detail'
  const substitutionAssist = isSubstitutionEvent(event)
    ? normalizePersonDisplayRef(getEventAssistName(event)) || 'assist'
    : null

  const keyParts = [
    matchId ?? event.match_id ?? 'match',
    getEventType(event) ?? 'type',
    displayDetail,
    getEventMinute(event) ?? 'minute',
    formatEventKeyExtra(getEventExtraMinute(event)),
    getEventTeamId(event) ?? event.team?.name ?? 'team',
    normalizePersonDisplayRef(getEventPlayerName(event)) || 'player',
  ]
  if (substitutionAssist) keyParts.push(substitutionAssist)

  return keyParts.map((part) =>
    String(part)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'none'
    ).join(':')
}

const formatMatchEventDisplayKey = formatMatchEventSemanticKey

function eventCompletenessScore(event: FootballEventLike) {
  const externalId = getEventExternalId(event)
  const values: unknown[] = [
    externalId,
    getEventTeamId(event) ?? event.team?.name,
    getEventPlayerId(event),
    getEventPlayerName(event),
    getEventAssistId(event),
    getEventAssistName(event),
    getEventMinute(event),
    getEventExtraMinute(event),
    getEventType(event),
    getEventDetail(event),
    getEventComments(event),
  ]

  return values.reduce<number>((score, value) => {
    if (value === null || value === undefined) return score
    const text = String(value).trim()
    if (!text) return score

    return score + 1 + Math.min(text.length, 40) / 40
  }, getMatchEventExternalIdPriority(externalId) * 100)
}

function getEventSortValue(event: FootballEventLike) {
  return (getEventMinute(event) ?? 0) * 100 + (getEventExtraMinute(event) ?? 0)
}

export function dedupeTimelineEvents<T extends FootballEventLike>(
  events: T[],
  options: {
    excludePenaltyShootout?: boolean
    descending?: boolean
    matchId?: string | number | null
    semanticDedupe?: boolean
  } = {}
) {
  const excludePenaltyShootout = options.excludePenaltyShootout ?? true
  const descending = options.descending ?? true
  const semanticDedupe = options.semanticDedupe ?? true
  const merged = new Map<string, T>()
  const displayKeyToStableKey = new Map<string, string>()

  for (const event of events) {
    if (excludePenaltyShootout && isPenaltyShootoutEvent(event)) continue

    const key = formatMatchEventStableKey(event, options.matchId)
    const displayKey = semanticDedupe
      ? formatMatchEventDisplayKey(event, options.matchId)
      : null
    const existingDisplayStableKey = displayKey
      ? displayKeyToStableKey.get(displayKey)
      : undefined

    if (merged.has(key)) continue

    if (existingDisplayStableKey) {
      const existing = merged.get(existingDisplayStableKey)

      if (
        existing &&
        eventCompletenessScore(event as FootballEventLike) >
          eventCompletenessScore(existing as FootballEventLike)
      ) {
        merged.delete(existingDisplayStableKey)
        merged.set(key, event)
        if (displayKey) displayKeyToStableKey.set(displayKey, key)
      }

      continue
    }

    merged.set(key, event)
    if (displayKey) displayKeyToStableKey.set(displayKey, key)
  }

  return [...merged.values()].sort((a, b) => {
    const sort = getEventSortValue(a) - getEventSortValue(b)
    return descending ? -sort : sort
  })
}

export function getTimelineEvents<T extends FootballEventLike>(
  events: T[],
  options: {
    excludePenaltyShootout?: boolean
    descending?: boolean
    matchId?: string | number | null
    semanticDedupe?: boolean
  } = {}
) {
  return dedupeTimelineEvents(events, options)
}

export function dedupeRankingEvents<T extends FootballEventLike>(events: T[]) {
  return dedupeTimelineEvents(events, {
    descending: false,
    excludePenaltyShootout: true,
    semanticDedupe: true,
  })
}

export function normalizeSubstitutionEvent(
  event: FootballEventLike,
  context: {
    starters?: PlayerRef[]
    substitutes?: PlayerRef[]
  } = {}
) {
  if (!isSubstitutionEvent(event)) return null

  const player = event.player ?? null
  const assist = event.assist ?? null
  const playerRef = player ?? {
    id: getEventPlayerId(event),
    name: getEventPlayerName(event),
  }
  const assistRef = assist ?? {
    id: getEventAssistId(event),
    name: getEventAssistName(event),
  }
  const playerLooksLikeSubstitute = playerMatchesRef(playerRef, context.substitutes)
  const assistLooksLikeStarter = playerMatchesRef(assistRef, context.starters)
  const playerLooksLikeStarter = playerMatchesRef(playerRef, context.starters)
  const assistLooksLikeSubstitute = playerMatchesRef(assistRef, context.substitutes)
  const apiFootballShape = playerLooksLikeStarter && assistLooksLikeSubstitute
  const reversedShape = playerLooksLikeSubstitute && assistLooksLikeStarter
  const playerId = getEventPlayerId(event)
  const assistId = getEventAssistId(event)
  const playerInName = apiFootballShape
    ? getEventAssistName(event)
    : reversedShape
      ? getEventPlayerName(event)
      : getEventAssistName(event)
  const playerOutName = apiFootballShape
    ? getEventPlayerName(event)
    : reversedShape
      ? getEventAssistName(event)
      : getEventPlayerName(event)
  const playerInId = apiFootballShape
    ? assistId
    : reversedShape
      ? playerId
      : assistId
  const playerOutId = apiFootballShape
    ? playerId
    : reversedShape
      ? assistId
      : playerId

  return {
    type: 'substitution' as const,
    minute: getEventMinute(event),
    extraMinute: getEventExtraMinute(event),
    teamId: getEventTeamId(event),
    teamName: event.team?.name ?? null,
    playerInId,
    playerInName,
    playerOutId,
    playerOutName,
    label: 'Cambio',
  }
}

export function getSubstitutionMap(
  events: FootballEventLike[],
  context: {
    starters?: PlayerRef[]
    substitutes?: PlayerRef[]
  } = {}
) {
  const byPlayerOutName = new Map<string, ReturnType<typeof normalizeSubstitutionEvent> & { type: 'substitution' }>()
  const byPlayerInName = new Map<string, ReturnType<typeof normalizeSubstitutionEvent> & { type: 'substitution' }>()
  const byPlayerOutId = new Map<string, ReturnType<typeof normalizeSubstitutionEvent> & { type: 'substitution' }>()
  const byPlayerInId = new Map<string, ReturnType<typeof normalizeSubstitutionEvent> & { type: 'substitution' }>()
  const byTeamId = new Map<string, Array<ReturnType<typeof normalizeSubstitutionEvent> & { type: 'substitution' }>>()

  for (const event of dedupeTimelineEvents(events, {
    excludePenaltyShootout: false,
    descending: false,
  })) {
    const substitution = normalizeSubstitutionEvent(event, context)
    if (!substitution) continue

    if (substitution.playerOutName) {
      byPlayerOutName.set(normalizeFootballEventText(substitution.playerOutName), substitution)
    }

    if (substitution.playerInName) {
      byPlayerInName.set(normalizeFootballEventText(substitution.playerInName), substitution)
    }

    const playerOutId = normalizeId(substitution.playerOutId)
    if (playerOutId) {
      byPlayerOutId.set(playerOutId, substitution)
    }

    const playerInId = normalizeId(substitution.playerInId)
    if (playerInId) {
      byPlayerInId.set(playerInId, substitution)
    }

    if (substitution.teamId !== null && substitution.teamId !== undefined) {
      const teamKey = String(substitution.teamId)
      const substitutions = byTeamId.get(teamKey) ?? []

      substitutions.push(substitution)
      byTeamId.set(teamKey, substitutions)
    }
  }

  return {
    byPlayerOutName,
    byPlayerInName,
    byPlayerOutId,
    byPlayerInId,
    byTeamId,
  }
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
    !isPenaltyShootoutEvent(event) &&
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

export const isValidAssistForAssistTable = isValidAssistEvent

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

export const isValidYellowCard = isYellowCardEvent

export function isValidGoalForScore(event: FootballEventLike) {
  return (
    !isPenaltyShootoutEvent(event) &&
    isScoreboardGoalEvent(getEventType(event), getEventDetail(event))
  )
}

export function isCancelledGoalEvent(event: FootballEventLike) {
  const combined = eventText(
    getEventType(event),
    getEventDetail(event),
    getEventComments(event)
  )

  return (
    isCancelledEvent(event) &&
    (
      combined.includes('goal') ||
      combined.includes('gol')
    )
  )
}

export function isCancelledCardEvent(event: FootballEventLike) {
  const combined = eventText(
    getEventType(event),
    getEventDetail(event),
    getEventComments(event)
  )

  return (
    isCancelledEvent(event) &&
    (
      combined.includes('card') ||
      combined.includes('tarjeta') ||
      combined.includes('yellow') ||
      combined.includes('red')
    )
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

export const isValidRedCard = isRedCardEvent

export function isSecondYellowCardEvent(event: FootballEventLike) {
  const normalizedType = normalizeFootballEventText(getEventType(event))
  const normalizedDetail = normalizeFootballEventText(getEventDetail(event))

  return (
    normalizedType.includes('card') &&
    normalizedDetail.includes('second yellow') &&
    !isCancelledEvent(event)
  )
}

export function isOwnGoal(event: FootballEventLike) {
  return getGoalKindFromDetail(getEventDetail(event)) === 'own-goal'
}

export const isMissedPenalty = isMissedPenaltyEvent

export function isGoalEvent(event: FootballEventLike) {
  const kind = normalizeMatchEvent(event).kind

  return kind === 'goal' || kind === 'penalty-goal' || kind === 'own-goal'
}

export function isCardEvent(event: FootballEventLike) {
  const kind = normalizeMatchEvent(event).kind

  return kind === 'yellow-card' || kind === 'red-card' || kind === 'second-yellow'
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
  if (combined.includes('red card')) return 'Roja'
  if (combined.includes('yellow card')) return 'Amarilla'
  if (combined.includes('own goal')) return 'Gol en contra'
  if (combined.includes('normal goal')) return 'Gol'
  if (isMissedPenaltyEvent({ type, detail, comments })) return 'Penal errado'
  if (combined.includes('penalty')) return 'Penal'
  if (combined.includes('injury')) return 'Lesión'
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

export type NormalizedMatchEventPlayerRole =
  | 'scorer'
  | 'assister'
  | 'carded'
  | 'substituted_in'
  | 'substituted_out'
  | 'var_subject'
  | 'missed_penalty_taker'
  | 'own_goal_player'
  | 'player'

export type NormalizedMatchEvent = {
  kind: NormalizedMatchEventKind
  label: string
  playerName: string | null
  assistName: string | null
  playerId: string | number | null
  assistId: string | number | null
  teamId: string | number | null
  playerRole: NormalizedMatchEventPlayerRole
  playerInName: string | null
  playerOutName: string | null
  minute: number | null
  extraMinute: number | null
  isGoalForScoreboard: boolean
  isMissedPenalty: boolean
  isSubstitution: boolean
  isVar: boolean
  isCard: boolean
  rawText: string
}

export function normalizeMatchEvent(event: FootballEventLike): NormalizedMatchEvent {
  const type = normalizeFootballEventText(getEventType(event))
  const detail = normalizeFootballEventText(getEventDetail(event))
  const comments = normalizeFootballEventText(getEventComments(event))
  const combined = eventText(type, detail, comments)
  const isOwnGoal =
    combined.includes('own goal') ||
    combined.includes('autogol') ||
    combined.includes('en contra')

  let kind: NormalizedMatchEventKind = 'event'

  if (isSubstitutionEvent(event)) kind = 'substitution'
  else if (isMissedPenaltyEvent(event)) kind = 'penalty-missed'
  else if (isVarEvent(event)) kind = 'var'
  else if (isInjuryEvent(event)) kind = 'injury'
  else if (detail.includes('second yellow')) kind = 'second-yellow'
  else if (detail.includes('red') || detail.includes('roja')) kind = 'red-card'
  else if (detail.includes('yellow') || detail.includes('amarilla')) kind = 'yellow-card'
  else if (type.includes('goal') && isOwnGoal) kind = 'own-goal'
  else if (type.includes('goal') && detail.includes('penalty')) kind = 'penalty-goal'
  else if (type.includes('penalty') || detail.includes('penalty') || comments.includes('penalty')) kind = 'penalty'
  else if (type.includes('goal')) kind = 'goal'

  let playerRole: NormalizedMatchEventPlayerRole = 'player'

  if (kind === 'goal' || kind === 'penalty-goal') playerRole = 'scorer'
  else if (kind === 'own-goal') playerRole = 'own_goal_player'
  else if (kind === 'penalty-missed') playerRole = 'missed_penalty_taker'
  else if (kind === 'yellow-card' || kind === 'red-card' || kind === 'second-yellow') {
    playerRole = 'carded'
  } else if (kind === 'substitution') {
    playerRole = 'substituted_out'
  } else if (kind === 'var') {
    playerRole = 'var_subject'
  }

  const substitution = kind === 'substitution'
    ? normalizeSubstitutionEvent(event)
    : null

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
    playerId: getEventPlayerId(event),
    assistId: getEventAssistId(event),
    teamId: getEventTeamId(event),
    playerRole,
    playerInName: substitution?.playerInName ?? null,
    playerOutName: substitution?.playerOutName ?? null,
    minute: getEventMinute(event),
    extraMinute: getEventExtraMinute(event),
    isGoalForScoreboard: isValidGoalForScore(event),
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

export function normalizePlayerIncident(
  event: FootballEventLike,
  player?: { id?: number | string | null; name?: string | null },
  teamId?: string | number | null
) {
  if (teamId !== undefined && teamId !== null && !sameEventTeam(event, teamId)) {
    return null
  }

  if (player && !isSubstitutionEvent(event) && !playerMatchesMainEvent(player, event, teamId)) {
    return null
  }

  return normalizeMatchEvent(event)
}

export function dedupePlayerIncidents<
  T extends {
    kind?: string
    label?: string
    playerName?: string | null
    assistName?: string | null
    playerId?: string | number | null
    assistId?: string | number | null
    teamId?: string | number | null
    playerRole?: string | null
    minute?: number | null
    extraMinute?: number | null
  }
>(incidents: T[]) {
  const seen = new Set<string>()
  const deduped: T[] = []

  for (const incident of incidents) {
    const playerRef =
      normalizePersonDisplayRef(incident.playerName) ||
      normalizeFootballEventText(incident.playerName) ||
      normalizeId(incident.playerId)
    const key = [
      incident.kind ?? 'event',
      normalizeId(incident.teamId),
      incident.playerRole ?? 'role',
      incident.minute ?? 'minute',
      incident.extraMinute ?? 'no-extra',
      playerRef,
    ].join(':')

    if (seen.has(key)) continue

    seen.add(key)
    deduped.push(incident)
  }

  return deduped
}

export function getPlayerIncidentsForLineup(
  player: { id?: number | string | null; name?: string | null },
  teamId: string | number | null | undefined,
  events: FootballEventLike[]
) {
  const playerName = normalizePlayerRef(player.name)
  const playerDisplayRef = normalizePersonDisplayRef(player.name)

  const incidents = dedupeTimelineEvents(events, {
    excludePenaltyShootout: false,
    descending: false,
  })
    .flatMap<NormalizedMatchEvent>((event) => {
      const normalized = normalizeMatchEvent(event)

      if (!sameEventTeam(event, teamId)) return []

      if (normalized.kind === 'substitution') {
        const substitution = normalizeSubstitutionEvent(event)
        const playerInName = normalizePlayerRef(substitution?.playerInName)
        const playerOutName = normalizePlayerRef(substitution?.playerOutName)
        const playerInRef = normalizePersonDisplayRef(substitution?.playerInName)
        const playerOutRef = normalizePersonDisplayRef(substitution?.playerOutName)

        if (
          playerName &&
          (
            playerInName === playerName ||
            (playerDisplayRef && playerInRef === playerDisplayRef)
          )
        ) {
          return [{
            ...normalized,
            playerId: player.id ?? normalized.playerId,
            playerName: substitution?.playerInName ?? normalized.playerName,
            playerRole: 'substituted_in' as const,
          }]
        }

        if (
          playerName &&
          (
            playerOutName === playerName ||
            (playerDisplayRef && playerOutRef === playerDisplayRef)
          )
        ) {
          return [{
            ...normalized,
            playerId: player.id ?? normalized.playerId,
            playerName: substitution?.playerOutName ?? normalized.playerName,
            playerRole: 'substituted_out' as const,
          }]
        }

        return []
      }

      if (!playerMatchesMainEvent(player, event, teamId)) {
        return []
      }

      return [{
        ...normalized,
        playerId: player.id ?? normalized.playerId,
        playerName: player.name ?? normalized.playerName,
      }]
    })

  return dedupePlayerIncidents(incidents)
}
