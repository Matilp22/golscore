'use client'

import { startTransition, useEffect } from 'react'
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

  useEffect(() => {
    startTransition(() => {
      router.refresh()
    })
  }, [router])

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
