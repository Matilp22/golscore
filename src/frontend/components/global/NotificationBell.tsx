'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFavoriteTeams } from '@/frontend/hooks/useFavoriteTeams'
import { useGlobalActionsData } from '@/frontend/hooks/useGlobalActionsData'
import { useMatchReminders } from '@/frontend/hooks/useMatchReminders'
import { isLiveStatus, isUpcomingStatus } from '@/shared/utils/match-status'

const READ_KEY = 'hf:notifications:read:v1'
const DISMISSED_KEY = 'hf:notifications:dismissed:v1'

type NotificationItem = {
  id: string
  kind: 'live' | 'event' | 'reminder' | 'favorite'
  title: string
  description: string
  href: string
  createdAt: string
  priority: number
}

function readStringList(key: string) {
  if (typeof window === 'undefined') return []

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeStringList(key: string, values: string[]) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(key, JSON.stringify(Array.from(new Set(values))))
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M15 17H9m9-1v-4.5a6 6 0 0 0-12 0V16l-1.5 2h15L18 16Zm-4.2 4a2 2 0 0 1-3.6 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<string[]>(() => readStringList(READ_KEY))
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => readStringList(DISMISSED_KEY))
  const panelRef = useRef<HTMLDivElement>(null)
  const { data } = useGlobalActionsData(true)
  const { favorites } = useFavoriteTeams()
  const { reminders } = useMatchReminders()

  useEffect(() => {
    if (!open) return

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    function handlePointerDown(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false)
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
    const generatedAt = data?.generatedAt ?? new Date().toISOString()
    const favoriteIds = new Set(favorites.map((favorite) => favorite.id))
    const favoriteNames = new Set(favorites.map((favorite) => normalize(favorite.name)))

    for (const reminder of reminders) {
      items.push({
        id: `reminder:${reminder.matchId}`,
        kind: 'reminder',
        title: `Recordatorio: ${reminder.home} vs ${reminder.away}`,
        description: `${reminder.displayTime || reminder.status || 'Horario a confirmar'}${reminder.tvLabel ? ` · ${reminder.tvLabel}` : ''}`,
        href: reminder.href,
        createdAt: reminder.createdAt,
        priority: 90,
      })
    }

    for (const match of data?.matches || []) {
      const homeFavorite = (match.homeId && favoriteIds.has(match.homeId)) || favoriteNames.has(normalize(match.home))
      const awayFavorite = (match.awayId && favoriteIds.has(match.awayId)) || favoriteNames.has(normalize(match.away))
      const favoriteTeamName = homeFavorite ? match.home : awayFavorite ? match.away : null

      if (isLiveStatus(match.statusShort)) {
        items.push({
          id: `live:${match.id}`,
          kind: 'live',
          title: `En vivo: ${match.home} vs ${match.away}`,
          description: `${match.displayScore} · ${match.displayStatus}${match.tvLabel ? ` · ${match.tvLabel}` : ''}`,
          href: match.href,
          createdAt: generatedAt,
          priority: 80,
        })
      }

      if (favoriteTeamName && (isLiveStatus(match.statusShort) || isUpcomingStatus(match.statusShort))) {
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
      .sort((a, b) => b.priority - a.priority || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12)
  }, [data, dismissedIds, favorites, reminders])

  const unreadCount = notifications.filter((notification) => !readIds.includes(notification.id)).length

  const markAllRead = () => {
    const nextIds = Array.from(new Set([...readIds, ...notifications.map((notification) => notification.id)]))
    setReadIds(nextIds)
    writeStringList(READ_KEY, nextIds)
  }

  const clearNotifications = () => {
    const nextDismissedIds = Array.from(new Set([...dismissedIds, ...notifications.map((notification) => notification.id)]))
    setDismissedIds(nextDismissedIds)
    writeStringList(DISMISSED_KEY, nextDismissedIds)
    markAllRead()
  }

  return (
    <div className="hf-notification-root" ref={panelRef}>
      <button
        type="button"
        className={`hf-global-icon-button hf-notification-bell ${unreadCount > 0 ? 'has-dot' : ''}`}
        aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <BellIcon />
        {unreadCount > 0 ? <span className="hf-notification-count">{unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="hf-notification-panel" role="dialog" aria-label="Notificaciones">
          <div className="hf-notification-head">
            <div>
              <strong>Notificaciones</strong>
              <span>{unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al dia'}</span>
            </div>
            <div>
              <button
                type="button"
                className="hf-notification-mark-read"
                onClick={markAllRead}
                disabled={!notifications.length}
              >
                Marcar leidas
              </button>
              <button
                type="button"
                className="hf-notification-clear"
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
                    onClick={() => setOpen(false)}
                  >
                    <span>{notification.kind === 'reminder' ? 'R' : notification.kind === 'favorite' ? 'F' : 'V'}</span>
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
              No hay notificaciones por ahora. Los recordatorios, favoritos y partidos en vivo van a aparecer aca.
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
