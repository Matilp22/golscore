'use client'

import { useMatchReminders } from '@/frontend/hooks/useMatchReminders'
import type { MatchReminderInput } from '@/frontend/services/matchRemindersService'

type MatchReminderButtonProps = {
  reminder: MatchReminderInput
  compact?: boolean
}

function BellIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M15 17H9m9-1v-4.5a6 6 0 0 0-12 0V16l-1.5 2h15L18 16Zm-4.2 4a2 2 0 0 1-3.6 0"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export default function MatchReminderButton({ reminder, compact = false }: MatchReminderButtonProps) {
  const { isEnabled, toggleReminder } = useMatchReminders()
  const active = isEnabled(reminder.matchId)

  return (
    <button
      type="button"
      className={`hf-match-reminder-button ${active ? 'is-active' : ''} ${compact ? 'is-compact' : ''}`}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        toggleReminder(reminder)
      }}
      aria-pressed={active}
      aria-label={active ? `Quitar recordatorio de ${reminder.home} vs ${reminder.away}` : `Recordarme ${reminder.home} vs ${reminder.away}`}
      title={active ? 'Recordatorio activo' : 'Recordarme'}
    >
      <BellIcon filled={active} />
      {compact ? null : <span>{active ? 'Recordando' : 'Recordarme'}</span>}
    </button>
  )
}
