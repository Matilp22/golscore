'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAutoRefresh } from '@/frontend/hooks/useAutoRefresh'

type AutoRefreshProps = {
  intervalMs?: number
  showButton?: boolean
  className?: string
  initialUpdatedAt?: number | string | Date
}

export default function AutoRefresh({
  intervalMs = 300000,
  initialUpdatedAt,
}: AutoRefreshProps) {
  const router = useRouter()
  useAutoRefresh({
    intervalMs,
    initialUpdatedAt,
    onRefresh: () => {
      startTransition(() => {
        router.refresh()
      })
    },
  })

  return null
}
