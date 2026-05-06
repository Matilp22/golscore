'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { HomeLiveEvent } from '@/lib/api-football'
import { formatEventMinute } from '@/shared/utils/event-minute'

type LiveEventToastItem = {
  key: string
  event: HomeLiveEvent
  expiresAt: number
}

type LiveEventToastsProps = {
  date: string
  enabled: boolean
  events: HomeLiveEvent[]
  visibleFixtureIds: Array<number | string>
  intervalMs?: number
}

const TOAST_TTL_MS = 7000

function getEventKey(event: HomeLiveEvent) {
  return event.id || [
    event.fixtureId,
    event.kind,
    event.detail ?? 'detail',
    event.minute ?? 'minute',
    event.extraMinute ?? 'no-extra',
    event.playerName ?? 'player',
  ].join(':')
}

function getToastBorder(kind: HomeLiveEvent['kind']) {
  if (kind === 'red-card') return 'border-[#ef4444]/75'
  if (kind === 'penalty') return 'border-[#f3d36c]/75'

  return 'border-[#7ff0b2]/75'
}

function getToastAccent(kind: HomeLiveEvent['kind']) {
  if (kind === 'red-card') return 'bg-[#ef4444]'
  if (kind === 'penalty') return 'bg-[#f3d36c]'

  return 'bg-[#7ff0b2]'
}

function formatToastTitle(event: HomeLiveEvent) {
  const matchLabel = `${event.home} ${event.score} ${event.away}`

  if (event.kind === 'penalty' && event.teamName) {
    return `Penal para ${event.teamName} en ${matchLabel}`
  }

  return `${event.label} en ${matchLabel}`
}

function formatToastDetail(event: HomeLiveEvent) {
  const minute = formatEventMinute(event.minute, event.extraMinute)
  const pieces = [minute]

  if (event.playerName && event.kind !== 'penalty') {
    pieces.push(event.playerName)
  }

  if (event.kind === 'penalty' && !event.teamName) {
    pieces.push(`${event.home} vs ${event.away}`)
  }

  return pieces.filter(Boolean).join(' \u00b7 ')
}

export default function LiveEventToasts({
  date,
  enabled,
  events,
  visibleFixtureIds,
  intervalMs = 30000,
}: LiveEventToastsProps) {
  const [toasts, setToasts] = useState<LiveEventToastItem[]>([])
  const seenEventsRef = useRef(new Set<string>())
  const seededDateRef = useRef<string | null>(null)
  const visibleFixtureIdsRef = useRef(new Set<string>())

  const enqueueEvents = useCallback((nextEvents: HomeLiveEvent[]) => {
    const freshEvents = nextEvents.filter((event) => {
      if (!visibleFixtureIdsRef.current.has(String(event.fixtureId))) return false

      const key = getEventKey(event)
      if (seenEventsRef.current.has(key)) return false
      seenEventsRef.current.add(key)
      return true
    })

    if (!freshEvents.length) return

    const nextToasts = freshEvents.map((event) => ({
      key: getEventKey(event),
      event,
      expiresAt: Date.now() + TOAST_TTL_MS,
    }))

    setToasts((current) => [...current, ...nextToasts].slice(-3))
  }, [])

  useEffect(() => {
    visibleFixtureIdsRef.current = new Set(visibleFixtureIds.map(String))
  }, [visibleFixtureIds])

  useEffect(() => {
    if (seededDateRef.current === date) return

    const visibleFixtureIdsSet = new Set(visibleFixtureIds.map(String))
    seenEventsRef.current = new Set(
      events
        .filter((event) => visibleFixtureIdsSet.has(String(event.fixtureId)))
        .map(getEventKey)
    )
    seededDateRef.current = date
  }, [date, events, visibleFixtureIds])

  useEffect(() => {
    if (seededDateRef.current !== date) return
    enqueueEvents(events)
  }, [date, enqueueEvents, events])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function loadLiveEvents() {
      if (document.hidden) return

      try {
        const response = await fetch(
          `/api/home/live-events?date=${encodeURIComponent(date)}`,
          { cache: 'no-store' }
        )
        const payload = (await response.json()) as { events?: HomeLiveEvent[] }

        if (!cancelled) {
          enqueueEvents(payload.events || [])
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[home-live-events] polling failed', {
            date,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    const intervalId = window.setInterval(loadLiveEvents, intervalMs)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [date, enabled, enqueueEvents, intervalMs])

  useEffect(() => {
    if (!toasts.length) return

    const nextExpiresAt = Math.min(...toasts.map((toast) => toast.expiresAt))
    const timeoutId = window.setTimeout(() => {
      const now = Date.now()
      setToasts((current) => current.filter((toast) => toast.expiresAt > now))
    }, Math.max(nextExpiresAt - Date.now(), 0))

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toasts])

  if (!toasts.length) return null

  return (
    <div className="pointer-events-none fixed inset-x-2 bottom-3 z-50 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-5 sm:w-[360px]">
      {toasts.map(({ key, event }) => (
        <div
          key={key}
          className={`pointer-events-auto overflow-hidden rounded-xl border bg-[#0f1317]/96 p-3 shadow-2xl shadow-black/35 backdrop-blur ${getToastBorder(event.kind)}`}
        >
          <div className="flex items-start gap-2">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${getToastAccent(event.kind)}`} />
            <div className="min-w-0">
              <p className="break-words text-sm font-black leading-snug text-white">
                {formatToastTitle(event)}
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold text-[#aab6c4]">
                {formatToastDetail(event)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
