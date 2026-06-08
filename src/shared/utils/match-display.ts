import { formatMatchTimeArgentina } from '@/shared/utils/argentina-time'
import { t, type AppLocale } from '@/shared/i18n/locales'
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
  locale?: AppLocale
}

type MatchScoreDisplayInput = {
  goalsHome?: number | string | null
  goalsAway?: number | string | null
  homePenaltyScore?: number | string | null
  awayPenaltyScore?: number | string | null
  separator?: string
  missing?: string
}

const POSTPONED_STATUS_KEYS: Record<string, Parameters<typeof t>[1]> = {
  pst: 'status.postponed',
  postponed: 'status.postponed',
  'match postponed': 'status.postponed',
  int: 'status.interrupted',
  interrupted: 'status.interrupted',
  'match interrupted': 'status.interrupted',
  susp: 'status.suspended',
  suspended: 'status.suspended',
  'match suspended': 'status.suspended',
  canc: 'status.cancelled',
  cancelled: 'status.cancelled',
  canceled: 'status.cancelled',
  'match cancelled': 'status.cancelled',
  'match canceled': 'status.cancelled',
  abd: 'status.suspended',
  abandoned: 'status.suspended',
  'match abandoned': 'status.suspended',
}

export function getPostponedStatusLabel(
  statusShort: string | null | undefined,
  locale: AppLocale = 'es'
) {
  const key = POSTPONED_STATUS_KEYS[normalizeMatchStatus(statusShort)]

  return key ? t(locale, key) : statusShort ?? t(locale, 'status.suspended')
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
  locale = 'es',
}: MatchStatusDisplayInput) {
  if (isFinishedStatus(statusShort)) return t(locale, 'status.finished')
  if (normalizeMatchStatus(statusShort) === 'ht') return t(locale, 'status.halftime')
  if (isLiveStatus(statusShort)) return minute ? `${t(locale, 'status.live')} ${minute}'` : t(locale, 'status.live')
  if (isUpcomingStatus(statusShort)) return formatMatchTimeArgentina(date)
  if (isPostponedStatus(statusShort)) return getPostponedStatusLabel(statusShort, locale)

  return statusShort
}

export function formatMatchStatusUnderScore({
  statusShort,
  minute,
  date,
  locale = 'es',
}: MatchStatusDisplayInput) {
  if (isFinishedStatus(statusShort)) return t(locale, 'status.finished')
  if (normalizeMatchStatus(statusShort) === 'ht') return t(locale, 'status.halftime')
  if (isLiveStatus(statusShort)) return minute ? `${minute}'` : t(locale, 'status.live')
  if (isUpcomingStatus(statusShort)) return formatMatchTimeArgentina(date)
  if (isPostponedStatus(statusShort)) return getPostponedStatusLabel(statusShort, locale)

  return statusShort
}
