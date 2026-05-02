import { isFinishedStatus, isLiveStatus } from '@/shared/utils/match-status'

type MatchStatusDisplayInput = {
  statusShort: string
  minute?: number | null
  date?: string | null
}

function formatMatchTime(dateString?: string | null) {
  if (!dateString) return 'A confirmar'

  return new Date(dateString).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

export function formatMatchStatusUnderScore({
  statusShort,
  minute,
  date,
}: MatchStatusDisplayInput) {
  if (isFinishedStatus(statusShort)) return 'Finalizado'
  if (statusShort === 'HT') return 'Entretiempo'
  if (isLiveStatus(statusShort)) return minute ? `${minute}'` : 'En vivo'
  if (statusShort === 'NS') return formatMatchTime(date)
  if (statusShort === 'PST') return 'Postergado'
  if (statusShort === 'SUSP') return 'Suspendido'
  if (statusShort === 'CANC') return 'Cancelado'
  if (statusShort === 'TBD') return 'A confirmar'

  return statusShort
}
