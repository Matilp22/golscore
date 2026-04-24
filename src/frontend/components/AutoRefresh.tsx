'use client'

import { startTransition, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  formatLastUpdatedLabel,
  useAutoRefresh,
} from '@/frontend/hooks/useAutoRefresh'

type AutoRefreshProps = {
  intervalMs?: number
  showButton?: boolean
  className?: string
  initialUpdatedAt?: number | string | Date
}

export default function AutoRefresh({
  intervalMs = 300000,
  showButton = false,
  className = '',
  initialUpdatedAt,
}: AutoRefreshProps) {
  const router = useRouter()
  const [isPending] = useTransition()
  const [isReloading, setIsReloading] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const { isRefreshing, lastUpdatedAt } = useAutoRefresh({
    intervalMs,
    initialUpdatedAt,
    onRefresh: () => {
      startTransition(() => {
        router.refresh()
      })
    },
  })

  const handleManualRefresh = () => {
    if (!navigator.onLine || isReloading) return

    setIsReloading(true)
    window.location.reload()
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  if (!showButton) {
    return (
      <p className={`text-xs font-semibold text-[#8d98a7] ${className}`}>
        {formatLastUpdatedLabel(lastUpdatedAt, now)}
      </p>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <p className="text-xs font-semibold text-[#8d98a7]">
        {formatLastUpdatedLabel(lastUpdatedAt, now)}
      </p>
      <button
        type="button"
        onClick={handleManualRefresh}
        disabled={isPending || isReloading || isRefreshing}
        className="inline-flex items-center gap-2 rounded-lg border border-white/8 bg-[#161a20] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#c8d0da] transition hover:bg-[#1c2128] disabled:cursor-wait disabled:opacity-70"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isReloading || isRefreshing ? 'animate-pulse bg-[#7ff0b2]' : 'bg-[#7ff0b2]/80'
          }`}
        />
        {isReloading ? 'Recargando' : isPending || isRefreshing ? 'Actualizando' : 'Actualizar'}
      </button>
    </div>
  )
}
