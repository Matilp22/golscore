'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type UseAutoRefreshOptions = {
  intervalMs?: number | null
  enabled?: boolean
  pauseWhenHidden?: boolean
  refreshOnFocus?: boolean
  refreshOnReconnect?: boolean
  initialUpdatedAt?: number | string | Date
  onRefresh: () => void | Promise<void>
}

function toTimestamp(value?: number | string | Date) {
  if (!value) return Date.now()

  if (typeof value === 'number') return value

  const parsed = new Date(value).getTime()

  return Number.isNaN(parsed) ? Date.now() : parsed
}

export function useAutoRefresh({
  intervalMs,
  enabled = true,
  pauseWhenHidden = true,
  refreshOnFocus = true,
  refreshOnReconnect = true,
  initialUpdatedAt,
  onRefresh,
}: UseAutoRefreshOptions) {
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => toTimestamp(initialUpdatedAt))
  const [isRefreshing, setIsRefreshing] = useState(false)
  const lastRefreshAtRef = useRef(0)
  const refreshCallbackRef = useRef(onRefresh)

  useEffect(() => {
    refreshCallbackRef.current = onRefresh
  }, [onRefresh])

  const canRefreshAgain = () => Date.now() - lastRefreshAtRef.current > 4000

  const refreshNow = useCallback(async () => {
    if (!enabled || !navigator.onLine || !canRefreshAgain()) return
    if (pauseWhenHidden && document.visibilityState !== 'visible') return

    lastRefreshAtRef.current = Date.now()
    setIsRefreshing(true)

    try {
      await refreshCallbackRef.current()
      setLastUpdatedAt(Date.now())
    } finally {
      setIsRefreshing(false)
    }
  }, [enabled, pauseWhenHidden])

  useEffect(() => {
    setLastUpdatedAt(toTimestamp(initialUpdatedAt))
  }, [initialUpdatedAt])

  const markUpdatedNow = useCallback(() => {
    setLastUpdatedAt(Date.now())
  }, [])

  useEffect(() => {
    if (!enabled || !intervalMs) return

    const intervalId = window.setInterval(() => {
      void refreshNow()
    }, intervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [enabled, intervalMs, refreshNow])

  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshNow()
      }
    }

    const handleFocus = () => {
      if (!refreshOnFocus) return
      void refreshNow()
    }

    const handleReconnect = () => {
      if (!refreshOnReconnect) return
      void refreshNow()
    }

    if (pauseWhenHidden) {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    if (refreshOnFocus) {
      window.addEventListener('focus', handleFocus)
    }

    if (refreshOnReconnect) {
      window.addEventListener('online', handleReconnect)
    }

    return () => {
      if (pauseWhenHidden) {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }

      if (refreshOnFocus) {
        window.removeEventListener('focus', handleFocus)
      }

      if (refreshOnReconnect) {
        window.removeEventListener('online', handleReconnect)
      }
    }
  }, [enabled, pauseWhenHidden, refreshNow, refreshOnFocus, refreshOnReconnect])

  return {
    isRefreshing,
    lastUpdatedAt,
    markUpdatedNow,
    refreshNow,
  }
}
