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

const POSTPONED_STATUS_LABELS: Record<string, string> = {
  pst: 'Postergado',
  susp: 'Suspendido',
  canc: 'Cancelado',
  abd: 'Suspendido',
}

export function getPostponedStatusLabel(statusShort: string | null | undefined) {
  return POSTPONED_STATUS_LABELS[normalizeMatchStatus(statusShort)] ?? statusShort ?? 'Suspendido'
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
