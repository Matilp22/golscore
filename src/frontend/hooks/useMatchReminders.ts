'use client'

import { useMemo, useSyncExternalStore } from 'react'
import {
  readMatchReminders,
  removeMatchReminder,
  subscribeToMatchReminders,
  toggleMatchReminder,
  type MatchReminder,
  type MatchReminderInput,
} from '@/frontend/services/matchRemindersService'

const EMPTY_REMINDERS: MatchReminder[] = []

function subscribe(onStoreChange: () => void) {
  return subscribeToMatchReminders(() => onStoreChange())
}

function getServerSnapshot() {
  return EMPTY_REMINDERS
}

export function useMatchReminders() {
  const reminders = useSyncExternalStore(
    subscribe,
    readMatchReminders,
    getServerSnapshot
  )

  return useMemo(
    () => ({
      reminders,
      isEnabled: (matchId: string | number) =>
        reminders.some((reminder) => reminder.matchId === String(matchId)),
      removeReminder: (matchId: string | number) => removeMatchReminder(matchId),
      toggleReminder: (reminder: MatchReminderInput) => toggleMatchReminder(reminder),
    }),
    [reminders]
  )
}
