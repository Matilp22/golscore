import Badge, { type BadgeTone } from '@/frontend/components/ui/Badge'
import {
  isFinishedStatus,
  isLiveStatus,
  isUpcomingStatus,
  normalizeMatchStatus,
} from '@/shared/utils/match-status'

type MatchStatusProps = {
  status: string | null | undefined
  label?: string | null
  minute?: number | null
  className?: string
}

function getStatusPresentation(
  status: string | null | undefined,
  label?: string | null
): { tone: BadgeTone; text: string; symbol: string } {
  const normalized = normalizeMatchStatus(status)

  if (isLiveStatus(normalized)) {
    return { tone: 'live', text: label || 'En vivo', symbol: '●' }
  }

  if (isFinishedStatus(normalized)) {
    return { tone: 'finished', text: label || 'Final', symbol: '✓' }
  }

  if (normalized === 'susp' || normalized.includes('suspend')) {
    return { tone: 'warning', text: label || 'Suspendido', symbol: 'Ⅱ' }
  }

  if (normalized === 'pst' || normalized.includes('postpon')) {
    return { tone: 'warning', text: label || 'Postergado', symbol: '↻' }
  }

  if (
    normalized === 'canc' ||
    normalized.includes('cancel') ||
    normalized.includes('abandon')
  ) {
    return { tone: 'danger', text: label || 'Cancelado', symbol: '×' }
  }

  if (isUpcomingStatus(normalized)) {
    return { tone: 'scheduled', text: label || 'Programado', symbol: '◷' }
  }

  return { tone: 'neutral', text: label || status || 'Sin confirmar', symbol: '•' }
}

export default function MatchStatus({
  status,
  label,
  minute,
  className,
}: MatchStatusProps) {
  const presentation = getStatusPresentation(status, label)
  const minuteLabel =
    presentation.tone === 'live' && typeof minute === 'number'
      ? ` ${minute}'`
      : ''

  return (
    <Badge
      tone={presentation.tone}
      className={className}
      icon={<span>{presentation.symbol}</span>}
    >
      {presentation.text}
      {minuteLabel}
    </Badge>
  )
}
