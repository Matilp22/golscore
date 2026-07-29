'use client'

import { useEffect, useState } from 'react'

import type { GlobalSearchCatalogData } from '@/shared/global-actions-data'

const catalogCache = new Map<string, GlobalSearchCatalogData>()

export function useSearchCatalog(query: string, enabled = true) {
  const normalizedQuery = query.trim().toLocaleLowerCase('es')
  const cached = catalogCache.get(normalizedQuery) ?? null
  const shouldFetch = enabled && normalizedQuery.length >= 2
  const [requestState, setRequestState] = useState<{
    query: string
    data: GlobalSearchCatalogData | null
    error: string
  }>({
    query: '',
    data: null,
    error: '',
  })

  useEffect(() => {
    if (!shouldFetch || catalogCache.has(normalizedQuery)) return

    const controller = new AbortController()

    fetch(`/api/search-catalog?q=${encodeURIComponent(normalizedQuery)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('No pudimos completar la búsqueda.')
        }

        return (await response.json()) as GlobalSearchCatalogData
      })
      .then((result) => {
        catalogCache.set(normalizedQuery, result)
        setRequestState({
          query: normalizedQuery,
          data: result,
          error: '',
        })
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return

        setRequestState({
          query: normalizedQuery,
          data: null,
          error:
            fetchError instanceof Error
              ? fetchError.message
              : 'No pudimos completar la búsqueda.',
        })
      })

    return () => controller.abort()
  }, [normalizedQuery, shouldFetch])

  const stateForQuery =
    requestState.query === normalizedQuery ? requestState : null
  const data = shouldFetch ? cached ?? stateForQuery?.data ?? null : null
  const error = shouldFetch ? stateForQuery?.error ?? '' : ''

  return {
    data,
    isLoading: Boolean(shouldFetch && !data && !error),
    error,
  }
}
