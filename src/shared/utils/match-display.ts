import { formatMatchTimeArgentina } from '@/shared/utils/argentina-time'
import {
  isFinishedStatus,
  isLiveStatus,
  isPostponedStatus,
  isUpcomingStatus,
  normalizeMatchStatus,
} from '@/shared/utils/match-status'

type MatchStatusDisplayInput = {
  statusShort: string
  minute?: number | null
  date?: string | null
}

type MatchScoreDisplayInput = {
  goalsHome?: number | string | null
  goalsAway?: number | string | null
  homePenaltyScore?: number | string | null
  awayPenaltyScore?: number | string | null
  separator?: string
  missing?: string
}

const POSTPONED_STATUS_LABELS: Record<string, string> = {
  pst: 'Postergado',
  postponed: 'Postergado',
  'match postponed': 'Postergado',
  int: 'Interrumpido',
  interrupted: 'Interrumpido',
  'match interrupted': 'Interrumpido',
  susp: 'Suspendido',
  suspended: 'Suspendido',
  'match suspended': 'Suspendido',
  canc: 'Cancelado',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
  'match cancelled': 'Cancelado',
  'match canceled': 'Cancelado',
  abd: 'Suspendido',
  abandoned: 'Suspendido',
  'match abandoned': 'Suspendido',
}

export function getPostponedStatusLabel(statusShort: string | null | undefined) {
  return POSTPONED_STATUS_LABELS[normalizeMatchStatus(statusShort)] ?? statusShort ?? 'Suspendido'
}

export function hasPenaltyShootoutScore(
  homePenaltyScore?: number | string | null,
  awayPenaltyScore?: number | string | null
) {
  return (
    homePenaltyScore !== null &&
    homePenaltyScore !== undefined &&
    homePenaltyScore !== '' &&
    awayPenaltyScore !== null &&
    awayPenaltyScore !== undefined &&
    awayPenaltyScore !== ''
  )
}

export function formatMatchScoreWithPenalties({
  goalsHome,
  goalsAway,
  homePenaltyScore,
  awayPenaltyScore,
  separator = ' - ',
  missing = '-',
}: MatchScoreDisplayInput) {
  const home = goalsHome ?? missing
  const away = goalsAway ?? missing

  if (hasPenaltyShootoutScore(homePenaltyScore, awayPenaltyScore)) {
    return `(${homePenaltyScore}) ${home} - ${away} (${awayPenaltyScore})`
  }

  return `${home}${separator}${away}`
}

export function formatHomeMatchStatus({
  statusShort,
  minute,
  date,
}: MatchStatusDisplayInput) {
  if (isFinishedStatus(statusShort)) return 'Finalizado'
  if (normalizeMatchStatus(statusShort) === 'ht') return 'Entretiempo'
  if (isLiveStatus(statusShort)) return minute ? `EN VIVO ${minute}'` : 'EN VIVO'
  if (isUpcomingStatus(statusShort)) return formatMatchTimeArgentina(date)
  if (isPostponedStatus(statusShort)) return getPostponedStatusLabel(statusShort)

  return statusShort
}

export function formatMatchStatusUnderScore({
  statusShort,
  minute,
  date,
}: MatchStatusDisplayInput) {
  if (isFinishedStatus(statusShort)) return 'Finalizado'
  if (normalizeMatchStatus(statusShort) === 'ht') return 'Entretiempo'
  if (isLiveStatus(statusShort)) return minute ? `${minute}'` : 'En vivo'
  if (isUpcomingStatus(statusShort)) return formatMatchTimeArgentina(date)
  if (isPostponedStatus(statusShort)) return getPostponedStatusLabel(statusShort)

  return statusShort
}
