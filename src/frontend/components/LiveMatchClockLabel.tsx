'use client'

import { useEffect, useState } from 'react'
import {
  isFinishedStatus,
  isLiveStatus,
  normalizeMatchStatus,
} from '@/shared/utils/match-status'

type LiveMatchClockLabelProps = {
  statusShort: string
  statusLong: string
  date: string
  initialElapsed?: number | null
  initialLabel: string
  renderedAt: string
}

function toTimestamp(value: string) {
  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp) ? timestamp : null
}

function toMinute(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null

  return Math.max(0, Math.floor(value))
}

function getKickoffBasedMinute(date: string, now: number) {
  const kickoffAt = toTimestamp(date)

  if (kickoffAt === null || kickoffAt > now) return null

  const minute = Math.floor((now - kickoffAt) / 60_000) + 1

  return minute > 0 && minute <= 60 ? minute : null
}

function getLiveElapsedMinute({
  date,
  initialElapsed,
  renderedAt,
  statusShort,
}: {
  date: string
  initialElapsed?: number | null
  renderedAt: string
  statusShort: string
}) {
  const now = Date.now()
  const renderedAtTimestamp = toTimestamp(renderedAt) ?? now
  const elapsedSinceRender = Math.max(
    0,
    Math.floor((now - renderedAtTimestamp) / 60_000)
  )
  const normalizedStatus = normalizeMatchStatus(statusShort)
  const baseMinute = toMinute(initialElapsed)
  let minute = baseMinute !== null ? baseMinute + elapsedSinceRender : null

  if (normalizedStatus === '1h' || normalizedStatus === 'live') {
    const kickoffMinute = getKickoffBasedMinute(date, now)

    if (
      kickoffMinute !== null &&
      (minute === null || kickoffMinute <= minute + 15)
    ) {
      minute = Math.max(minute ?? 0, kickoffMinute)
    }
  }

  return minute
}

function formatLiveLabel(input: LiveMatchClockLabelProps) {
  const normalizedStatus = normalizeMatchStatus(input.statusShort)

  if (isFinishedStatus(input.statusShort) || isFinishedStatus(input.statusLong)) {
    return input.initialLabel
  }

  if (normalizedStatus === 'ht') return 'ET'

  if (!isLiveStatus(input.statusShort)) return input.initialLabel

  const minute = getLiveElapsedMinute(input)

  return minute ? `${minute}'` : input.initialLabel
}

function keepForwardMinute(current: string, next: string) {
  const currentMinute = Number.parseInt(current, 10)
  const nextMinute = Number.parseInt(next, 10)

  if (
    Number.isFinite(currentMinute) &&
    Number.isFinite(nextMinute) &&
    currentMinute > nextMinute
  ) {
    return current
  }

  return next
}

export default function LiveMatchClockLabel({
  statusShort,
  statusLong,
  date,
  initialElapsed,
  initialLabel,
  renderedAt,
}: LiveMatchClockLabelProps) {
  const [label, setLabel] = useState(() =>
    formatLiveLabel({
      statusShort,
      statusLong,
      date,
      initialElapsed,
      initialLabel,
      renderedAt,
    })
  )
  const isActivelyRunning =
    !isFinishedStatus(statusShort) &&
    !isFinishedStatus(statusLong) &&
    isLiveStatus(statusShort) &&
    normalizeMatchStatus(statusShort) !== 'ht'
  const currentLabel = formatLiveLabel({
    statusShort,
    statusLong,
    date,
    initialElapsed,
    initialLabel,
    renderedAt,
  })

  useEffect(() => {
    if (!isActivelyRunning) return

    const intervalId = window.setInterval(() => {
      setLabel((current) => {
        return keepForwardMinute(
          current,
          formatLiveLabel({
            statusShort,
            statusLong,
            date,
            initialElapsed,
            initialLabel,
            renderedAt,
          })
        )
      })
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [
    date,
    initialElapsed,
    initialLabel,
    isActivelyRunning,
    renderedAt,
    statusLong,
    statusShort,
  ])

  return (
    <span suppressHydrationWarning>
      {isActivelyRunning ? keepForwardMinute(label, currentLabel) : currentLabel}
    </span>
  )
}
