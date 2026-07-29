'use client'

import Link from 'next/link'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import { useFavoriteTeams } from '@/frontend/hooks/useFavoriteTeams'
import { useGlobalActionsData } from '@/frontend/hooks/useGlobalActionsData'
import { useMatchReminders } from '@/frontend/hooks/useMatchReminders'
import { isLiveStatus, isUpcomingStatus } from '@/shared/utils/match-status'

const READ_KEY = 'hf:notifications:read:v1'
const DISMISSED_KEY = 'hf:notifications:dismissed:v1'
const CHANGED_EVENT = 'hf:notifications:changed'
const EMPTY_IDS: string[] = []
const listCache = new Map<
  string,
  { raw: string | null; values: string[] }
>()

type NotificationItem = {
  id: string
  kind: 'live' | 'event' | 'reminder' | 'favorite'
  title: string
  description: string
  href: string
  createdAt: string
  priority: number
}

function parseStringList(raw: string | null) {
  if (!raw) return EMPTY_IDS

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : EMPTY_IDS
  } catch {
    return EMPTY_IDS
  }
}

function readStringList(key: string) {
  if (typeof window === 'undefined') return EMPTY_IDS

  const raw = window.localStorage.getItem(key)
  const cached = listCache.get(key)
  if (cached?.raw === raw) return cached.values

  const values = parseStringList(raw)
  listCache.set(key, { raw, values })
  return values
}

function writeStringList(key: string, values: string[]) {
  if (typeof window === 'undefined') return

  const uniqueValues = Array.from(new Set(values))
  const raw = JSON.stringify(uniqueValues)
  window.localStorage.setItem(key, raw)
  listCache.set(key, { raw, values: uniqueValues })
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: key }))
}

function subscribeToKey(key: string, onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}

  function handleStorage(event: StorageEvent) {
    if (event.key !== key) return
    listCache.delete(key)
    onStoreChange()
  }

  function handleLocal(event: Event) {
    const changedKey = (event as CustomEvent<string>).detail
    if (changedKey === key) onStoreChange()
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(CHANGED_EVENT, handleLocal)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(CHANGED_EVENT, handleLocal)
  }
}

function subscribeRead(onStoreChange: () => void) {
  return subscribeToKey(READ_KEY, onStoreChange)
}

function subscribeDismissed(onStoreChange: () => void) {
  return subscribeToKey(DISMISSED_KEY, onStoreChange)
}

function getReadSnapshot() {
  return readStringList(READ_KEY)
}

function getDismissedSnapshot() {
  return readStringList(DISMISSED_KEY)
}

function getServerSnapshot() {
  return EMPTY_IDS
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 17H9m9-1v-4.5a6 6 0 0 0-12 0V16l-1.5 2h15L18 16Zm-4.2 4a2 2 0 0 1-3.6 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  )
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getKindLabel(kind: NotificationItem['kind']) {
  if (kind === 'reminder') return 'Recordatorio'
  if (kind === 'favorite') return 'Favorito'
  if (kind === 'event') return 'Incidencia'
  return 'En vivo'
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const readIds = useSyncExternalStore(
    subscribeRead,
    getReadSnapshot,
    getServerSnapshot
  )
  const dismissedIds = useSyncExternalStore(
    subscribeDismissed,
    getDismissedSnapshot,
    getServerSnapshot
  )
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { data } = useGlobalActionsData(true)
  const { favorites } = useFavoriteTeams()
  const { reminders } = useMatchReminders()

  useEffect(() => {
    if (!open) return

    function handleKeydown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return

      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }

    function handlePointerDown(event: PointerEvent) {
      if (panelRef.current?.contains(event.target as Node)) return
      if (triggerRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [open])

  const notifications = useMemo(() => {
    const items: NotificationItem[] = []
    const generatedAt = data?.generatedAt ?? ''
    const favoriteIds = new Set(favorites.map((favorite) => favorite.id))
    const favoriteNames = new Set(
      favorites.map((favorite) => normalize(favorite.name))
    )

    for (const reminder of reminders) {
      items.push({
        id: `reminder:${reminder.matchId}`,
        kind: 'reminder',
        title: `${reminder.home} vs ${reminder.away}`,
        description: `${reminder.displayTime || reminder.status || 'Horario a confirmar'}${reminder.tvLabel ? ` · ${reminder.tvLabel}` : ''}`,
        href: reminder.href,
        createdAt: reminder.createdAt,
        priority: 90,
      })
    }

    for (const match of data?.matches || []) {
      const homeFavorite =
        (match.homeId && favoriteIds.has(match.homeId)) ||
        favoriteNames.has(normalize(match.home))
      const awayFavorite =
        (match.awayId && favoriteIds.has(match.awayId)) ||
        favoriteNames.has(normalize(match.away))
      const favoriteTeamName = homeFavorite
        ? match.home
        : awayFavorite
          ? match.away
          : null

      if (isLiveStatus(match.statusShort)) {
        items.push({
          id: `live:${match.id}`,
          kind: 'live',
          title: `${match.home} vs ${match.away}`,
          description: `${match.displayScore} · ${match.displayStatus}${match.tvLabel ? ` · ${match.tvLabel}` : ''}`,
          href: match.href,
          createdAt: generatedAt,
          priority: 80,
        })
      }

      if (
        favoriteTeamName &&
        (isLiveStatus(match.statusShort) ||
          isUpcomingStatus(match.statusShort))
      ) {
        items.push({
          id: `favorite:${favoriteTeamName}:${match.id}`,
          kind: 'favorite',
          title: `${favoriteTeamName} tiene partido`,
          description: `${match.home} vs ${match.away} · ${match.displayTime}`,
          href: match.href,
          createdAt: generatedAt,
          priority: isLiveStatus(match.statusShort) ? 85 : 65,
        })
      }
    }

    for (const event of data?.liveEvents || []) {
      items.push({
        id: `event:${event.id}`,
        kind: 'event',
        title: event.title,
        description: event.description,
        href: event.href,
        createdAt: event.createdAt,
        priority: 95,
      })
    }

    const byId = new Map(items.map((item) => [item.id, item]))

    return Array.from(byId.values())
      .filter((item) => !dismissedIds.includes(item.id))
      .sort(
        (a, b) =>
          b.priority - a.priority || b.createdAt.localeCompare(a.createdAt)
      )
      .slice(0, 12)
  }, [data, dismissedIds, favorites, reminders])

  const unreadCount = notifications.filter(
    (notification) => !readIds.includes(notification.id)
  ).length

  function markAllRead() {
    writeStringList(READ_KEY, [
      ...readIds,
      ...notifications.map((notification) => notification.id),
    ])
  }

  function markRead(id: string) {
    writeStringList(READ_KEY, [...readIds, id])
    setOpen(false)
  }

  function clearNotifications() {
    writeStringList(DISMISSED_KEY, [
      ...dismissedIds,
      ...notifications.map((notification) => notification.id),
    ])
    markAllRead()
  }

  return (
    <div className="hf-notification-root" ref={panelRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`hf-global-icon-button hf-notification-bell ${unreadCount > 0 ? 'has-dot' : ''}`}
        aria-label={
          unreadCount > 0
            ? `Notificaciones, ${unreadCount} sin leer`
            : 'Notificaciones'
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="hf-notification-count">{unreadCount}</span>
        ) : null}
      </button>

      {open ? (
        <div
          className="hf-notification-panel"
          role="dialog"
          aria-label="Notificaciones"
        >
          <div className="hf-notification-head">
            <div>
              <strong>Notificaciones</strong>
              <span>
                {unreadCount > 0
                  ? `${unreadCount} sin leer`
                  : 'Todo al día'}
              </span>
            </div>
            <div>
              <button
                type="button"
                onClick={markAllRead}
                disabled={!notifications.length || unreadCount === 0}
              >
                Marcar leídas
              </button>
              <button
                type="button"
                onClick={clearNotifications}
                disabled={!notifications.length}
              >
                Limpiar
              </button>
            </div>
          </div>

          {notifications.length ? (
            <div className="hf-notification-list">
              {notifications.map((notification) => {
                const unread = !readIds.includes(notification.id)

                return (
                  <Link
                    key={notification.id}
                    href={notification.href}
                    className={unread ? 'is-unread' : ''}
                    onClick={() => markRead(notification.id)}
                  >
                    <span>{getKindLabel(notification.kind)}</span>
                    <span>
                      <strong>{notification.title}</strong>
                      <small>{notification.description}</small>
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="hf-notification-empty">
              <strong>Sin novedades por ahora</strong>
              <p>
                Acá aparecen recordatorios, favoritos e incidencias en vivo.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
