'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  isMatchReminderEnabled,
  readMatchReminders,
  removeMatchReminder,
  subscribeToMatchReminders,
  toggleMatchReminder,
  type MatchReminder,
  type MatchReminderInput,
} from '@/frontend/services/matchRemindersService'

export function useMatchReminders() {
  const [reminders, setReminders] = useState<MatchReminder[]>(() => readMatchReminders())

  useEffect(() => {
    return subscribeToMatchReminders(setReminders)
  }, [])

  return useMemo(
    () => ({
      reminders,
      isEnabled: (matchId: string | number) =>
        reminders.some((reminder) => reminder.matchId === String(matchId)) ||
        isMatchReminderEnabled(matchId),
      removeReminder: (matchId: string | number) => removeMatchReminder(matchId),
      toggleReminder: (reminder: MatchReminderInput) => toggleMatchReminder(reminder),
    }),
    [reminders]
  )
}
