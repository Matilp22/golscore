'use client'

export const MATCH_REMINDERS_STORAGE_KEY = 'hf:match-reminders:v1'
export const MATCH_REMINDERS_CHANGED_EVENT = 'hf:match-reminders:changed'

export type MatchReminder = {
  matchId: string
  href: string
  home: string
  away: string
  homeLogo?: string | null
  awayLogo?: string | null
  date?: string | null
  displayTime?: string | null
  status?: string | null
  tvLabel?: string | null
  tvLogoUrl?: string | null
  createdAt: string
}

export type MatchReminderInput = Omit<MatchReminder, 'createdAt'> & {
  createdAt?: string
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function normalizeReminder(reminder: MatchReminderInput): MatchReminder {
  return {
    matchId: String(reminder.matchId),
    href: reminder.href,
    home: reminder.home,
    away: reminder.away,
    homeLogo: reminder.homeLogo ?? null,
    awayLogo: reminder.awayLogo ?? null,
    date: reminder.date ?? null,
    displayTime: reminder.displayTime ?? null,
    status: reminder.status ?? null,
    tvLabel: reminder.tvLabel ?? null,
    tvLogoUrl: reminder.tvLogoUrl ?? null,
    createdAt: reminder.createdAt || new Date().toISOString(),
  }
}

function parseReminders(raw: string | null): MatchReminder[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is MatchReminderInput => {
        return Boolean(
          item &&
          typeof item === 'object' &&
          'matchId' in item &&
          'href' in item &&
          'home' in item &&
          'away' in item
        )
      })
      .map(normalizeReminder)
  } catch {
    return []
  }
}

function notifyRemindersChanged(reminders: MatchReminder[]) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent(MATCH_REMINDERS_CHANGED_EVENT, {
      detail: reminders,
    })
  )
}

export function readMatchReminders() {
  if (!canUseStorage()) return []

  return parseReminders(window.localStorage.getItem(MATCH_REMINDERS_STORAGE_KEY))
}

export function writeMatchReminders(reminders: MatchReminder[]) {
  if (!canUseStorage()) return reminders

  const normalizedReminders = reminders.map(normalizeReminder)
  window.localStorage.setItem(MATCH_REMINDERS_STORAGE_KEY, JSON.stringify(normalizedReminders))
  notifyRemindersChanged(normalizedReminders)

  return normalizedReminders
}

export function isMatchReminderEnabled(matchId: string | number) {
  const id = String(matchId)

  return readMatchReminders().some((reminder) => reminder.matchId === id)
}

export function addMatchReminder(reminder: MatchReminderInput) {
  const normalizedReminder = normalizeReminder(reminder)
  const reminders = readMatchReminders()

  if (reminders.some((current) => current.matchId === normalizedReminder.matchId)) return reminders

  return writeMatchReminders([...reminders, normalizedReminder])
}

export function removeMatchReminder(matchId: string | number) {
  const id = String(matchId)

  return writeMatchReminders(readMatchReminders().filter((reminder) => reminder.matchId !== id))
}

export function toggleMatchReminder(reminder: MatchReminderInput) {
  const normalizedReminder = normalizeReminder(reminder)

  if (isMatchReminderEnabled(normalizedReminder.matchId)) {
    return {
      enabled: false,
      reminders: removeMatchReminder(normalizedReminder.matchId),
    }
  }

  return {
    enabled: true,
    reminders: addMatchReminder(normalizedReminder),
  }
}

export function subscribeToMatchReminders(callback: (reminders: MatchReminder[]) => void) {
  if (typeof window === 'undefined') return () => {}

  const handleLocalChange = (event: Event) => {
    const customEvent = event as CustomEvent<MatchReminder[]>
    callback(Array.isArray(customEvent.detail) ? customEvent.detail : readMatchReminders())
  }
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === MATCH_REMINDERS_STORAGE_KEY) callback(parseReminders(event.newValue))
  }

  window.addEventListener(MATCH_REMINDERS_CHANGED_EVENT, handleLocalChange)
  window.addEventListener('storage', handleStorageChange)

  return () => {
    window.removeEventListener(MATCH_REMINDERS_CHANGED_EVENT, handleLocalChange)
    window.removeEventListener('storage', handleStorageChange)
  }
}
