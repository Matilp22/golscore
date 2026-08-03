'use client'

import { useEffect, useState } from 'react'

import { useAuth } from '@/frontend/hooks/useAuth'
import {
  getFavoriteLeagueErrorInfo,
  getUserFavoriteLeagues,
  toggleFavoriteLeague,
} from '@/frontend/services/favoriteLeaguesService'

const STORAGE_KEY = 'fulboapp:favorites:v1'
const FAVORITES_EVENT = 'fulboapp:favorites-updated'
const remoteFavoritesCache = new Map<string, string[]>()
const remoteFavoritesRequests = new Map<string, Promise<string[]>>()

function loadRemoteFavorites(userId: string) {
  const cached = remoteFavoritesCache.get(userId)
  if (cached) return Promise.resolve(cached)

  const pending = remoteFavoritesRequests.get(userId)
  if (pending) return pending

  const request = getUserFavoriteLeagues(userId)
    .then((favorites) => {
      remoteFavoritesCache.set(userId, favorites)
      remoteFavoritesRequests.delete(userId)
      return favorites
    })
    .catch((error) => {
      remoteFavoritesRequests.delete(userId)
      throw error
    })

  remoteFavoritesRequests.set(userId, request)
  return request
}

function readLocalFavorites() {
  if (typeof window === 'undefined') return [] as string[]

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : []
  } catch {
    return []
  }
}

function writeLocalFavorites(favorites: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
  window.dispatchEvent(new CustomEvent(FAVORITES_EVENT))
}

export default function FavoriteCompetitionButton({
  leagueKey,
  leagueName,
  className = '',
}: {
  leagueKey: string
  leagueName: string
  className?: string
}) {
  const { user } = useAuth()
  const [isFavorite, setIsFavorite] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [remoteReady, setRemoteReady] = useState(false)

  useEffect(() => {
    let active = true

    if (!user) {
      const syncLocalState = () => {
        if (active) setIsFavorite(readLocalFavorites().includes(leagueKey))
      }

      setRemoteReady(false)
      syncLocalState()
      window.addEventListener(FAVORITES_EVENT, syncLocalState)
      return () => {
        active = false
        window.removeEventListener(FAVORITES_EVENT, syncLocalState)
      }
    }

    const syncRemoteState = () => {
      const favorites = remoteFavoritesCache.get(user.id)
      if (favorites && active) setIsFavorite(favorites.includes(leagueKey))
    }

    window.addEventListener(FAVORITES_EVENT, syncRemoteState)
    loadRemoteFavorites(user.id)
      .then((favorites) => {
        if (!active) return
        setIsFavorite(favorites.includes(leagueKey))
        setRemoteReady(true)
      })
      .catch((error: unknown) => {
        console.warn('[competition-favorite] Se usa persistencia local.', getFavoriteLeagueErrorInfo(error))
        if (!active) return
        setIsFavorite(readLocalFavorites().includes(leagueKey))
        setRemoteReady(false)
      })

    return () => {
      active = false
      window.removeEventListener(FAVORITES_EVENT, syncRemoteState)
    }
  }, [leagueKey, user])

  async function handleToggle() {
    if (isPending) return

    const previous = isFavorite
    const next = !previous
    setIsFavorite(next)
    setIsPending(true)

    try {
      if (user && remoteReady) {
        await toggleFavoriteLeague(user.id, leagueKey, previous)
        const favorites = remoteFavoritesCache.get(user.id) ?? []
        remoteFavoritesCache.set(
          user.id,
          next
            ? Array.from(new Set([...favorites, leagueKey]))
            : favorites.filter((value) => value !== leagueKey)
        )
        window.dispatchEvent(new CustomEvent(FAVORITES_EVENT))
      } else {
        const favorites = readLocalFavorites()
        writeLocalFavorites(
          next
            ? Array.from(new Set([...favorites, leagueKey]))
            : favorites.filter((value) => value !== leagueKey)
        )
      }
    } catch (error: unknown) {
      console.warn('[competition-favorite] No se pudo sincronizar el favorito.', getFavoriteLeagueErrorInfo(error))
      setIsFavorite(previous)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button
      type="button"
      className={`hf-favorite-competition ${isFavorite ? 'is-favorite' : ''} ${className}`.trim()}
      onClick={handleToggle}
      aria-pressed={isFavorite}
      aria-label={`${isFavorite ? 'Quitar' : 'Agregar'} ${leagueName} ${isFavorite ? 'de' : 'a'} favoritos`}
      disabled={isPending}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3.5 2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.52 6.9 19.2l.97-5.68L3.75 9.5l5.7-.83L12 3.5Z" />
      </svg>
      <span>{isFavorite ? 'Guardada' : 'Favorito'}</span>
    </button>
  )
}
