'use client'

import { useEffect, useState } from 'react'
import type { GlobalActionsData } from '@/shared/global-actions-data'

let cachedData: GlobalActionsData | null = null
let pendingRequest: Promise<GlobalActionsData> | null = null

async function fetchGlobalActionsData(signal?: AbortSignal) {
  if (cachedData) return cachedData
  if (pendingRequest) return pendingRequest

  pendingRequest = fetch('/api/global-actions-data', {
    cache: 'no-store',
    signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('No se pudieron cargar datos globales.')
      return (await response.json()) as GlobalActionsData
    })
    .then((data) => {
      cachedData = data
      return data
    })
    .finally(() => {
      pendingRequest = null
    })

  return pendingRequest
}

export function useGlobalActionsData(enabled = true) {
  const [data, setData] = useState<GlobalActionsData | null>(cachedData)
  const [isLoading, setIsLoading] = useState(Boolean(enabled && !cachedData))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled || data) return

    const controller = new AbortController()

    fetchGlobalActionsData(controller.signal)
      .then(setData)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setError(error instanceof Error ? error.message : 'No se pudieron cargar datos globales.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [data, enabled])

  return {
    data,
    isLoading: isLoading || Boolean(enabled && !data && !error),
    error,
  }
}
