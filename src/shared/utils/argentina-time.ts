export const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires'

const DATE_TIME_WITHOUT_ZONE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/
const EXPLICIT_TIME_ZONE_PATTERN = /(z|[+-]\d{2}:?\d{2})$/i

function hasExplicitTimeZone(value: string) {
  return EXPLICIT_TIME_ZONE_PATTERN.test(value.trim())
}

function getArgentinaWallClockParts(value: string) {
  if (hasExplicitTimeZone(value)) return null

  const match = value.trim().match(DATE_TIME_WITHOUT_ZONE_PATTERN)
  if (!match) return null

  return {
    year: match[1],
    month: match[2],
    day: match[3],
    hour: match[4] ?? '00',
    minute: match[5] ?? '00',
    second: match[6] ?? '00',
  }
}

export function toArgentinaDate(date: string | number | Date) {
  if (typeof date === 'string') {
    const parts = getArgentinaWallClockParts(date)

    if (parts) {
      return new Date(
        `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-03:00`
      )
    }
  }

  return new Date(date)
}

export function getArgentinaDateISO(date: string | number | Date = new Date()) {
  if (typeof date === 'string') {
    const parts = getArgentinaWallClockParts(date)
    if (parts) return `${parts.year}-${parts.month}-${parts.day}`
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(toArgentinaDate(date))
}

export function getArgentinaTodayISO() {
  return getArgentinaDateISO(new Date())
}

export function addDaysToISO(isoDate: string, amount: number) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utcDate = new Date(Date.UTC(year, month - 1, day))
  utcDate.setUTCDate(utcDate.getUTCDate() + amount)

  const y = utcDate.getUTCFullYear()
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(utcDate.getUTCDate()).padStart(2, '0')

  return `${y}-${m}-${d}`
}

export function formatMatchTimeArgentina(date?: string | number | Date | null) {
  if (!date) return 'A confirmar'

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(toArgentinaDate(date))
}

export function formatMatchDateTimeArgentina(date?: string | number | Date | null) {
  if (!date) return 'A confirmar'

  return `${getArgentinaDateISO(date)} ${formatMatchTimeArgentina(date)}`
}

export function getArgentinaMatchTimestamp(date?: string | number | Date | null) {
  if (!date) return NaN

  return toArgentinaDate(date).getTime()
}
