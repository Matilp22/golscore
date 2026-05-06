'use client'

import { startTransition, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAutoRefresh } from '@/frontend/hooks/useAutoRefresh'

type AutoRefreshProps = {
  intervalMs?: number
  showButton?: boolean
  className?: string
  initialUpdatedAt?: number | string | Date
  syncBeforeRefreshUrl?: string | null
}

export default function AutoRefresh({
  intervalMs = 300000,
  initialUpdatedAt,
  syncBeforeRefreshUrl,
}: AutoRefreshProps) {
  const router = useRouter()

  const syncWithoutRefresh = useCallback(async () => {
    if (!syncBeforeRefreshUrl) return

    await fetch(syncBeforeRefreshUrl, {
      cache: 'no-store',
    }).catch((error) => {
      console.warn('[auto-refresh] No se pudo sincronizar partidos en vivo.', error)
    })
  }, [syncBeforeRefreshUrl])

  const refreshWithOptionalSync = useCallback(async () => {
    await syncWithoutRefresh()

    startTransition(() => {
      router.refresh()
    })
  }, [router, syncWithoutRefresh])

  useEffect(() => {
    if (syncBeforeRefreshUrl) {
      void syncWithoutRefresh()
      return
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

    if (!isStandalone) return

    void refreshWithOptionalSync()
  }, [refreshWithOptionalSync, syncBeforeRefreshUrl, syncWithoutRefresh])

  useAutoRefresh({
    intervalMs,
    initialUpdatedAt,
    onRefresh: () => {
      return refreshWithOptionalSync()
    },
  })

  return null
}
