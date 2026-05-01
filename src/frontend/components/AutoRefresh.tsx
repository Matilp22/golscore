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

  const refreshWithOptionalSync = useCallback(async () => {
    if (syncBeforeRefreshUrl) {
      await fetch(syncBeforeRefreshUrl, {
        cache: 'no-store',
      }).catch((error) => {
        console.warn('[auto-refresh] No se pudo sincronizar partidos en vivo.', error)
      })
    }

    startTransition(() => {
      router.refresh()
    })
  }, [router, syncBeforeRefreshUrl])

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

    if (!isStandalone) return

    void refreshWithOptionalSync()
  }, [refreshWithOptionalSync])

  useAutoRefresh({
    intervalMs,
    initialUpdatedAt,
    onRefresh: () => {
      return refreshWithOptionalSync()
    },
  })

  return null
}
