'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/frontend/hooks/useAuth'
import {
  getFavoriteLeagueErrorInfo,
  getUserFavoriteLeagues,
  toggleFavoriteLeague,
} from '@/frontend/services/favoriteLeaguesService'
import { TOURNAMENT_PAGE_CONFIGS } from '@/shared/config/tournament-pages'

const FAVORITES_STORAGE_KEY = 'fulboapp:favorites:v1'
const LEGACY_FAVORITES_STORAGE_KEY = ['gol', 'score:favorites:v1'].join('')

function readLocalFavorites() {
  if (typeof window === 'undefined') return []

  try {
    const raw =
      window.localStorage.getItem(FAVORITES_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_FAVORITES_STORAGE_KEY) ??
      '[]'
    const parsed: unknown = JSON.parse(raw)

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function writeLocalFavorites(keys: string[]) {
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(keys))
}

export default function FavoriteCompetitionsList() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    if (isAuthLoading) return () => {
      active = false
    }

    if (!user) {
      queueMicrotask(() => {
        if (!active) return
        setRemoteUserId(null)
        setFavoriteKeys(readLocalFavorites())
        setIsLoading(false)
      })
      return () => {
        active = false
      }
    }

    queueMicrotask(() => {
      if (active) setIsLoading(true)
    })
    getUserFavoriteLeagues(user.id)
      .then((favorites) => {
        if (!active) return
        setRemoteUserId(user.id)
        setFavoriteKeys(favorites)
        setNotice('')
      })
      .catch((error: unknown) => {
        console.warn(
          '[favorite-competitions] No se pudieron cargar favoritos remotos.',
          getFavoriteLeagueErrorInfo(error)
        )
        if (!active) return
        setRemoteUserId(null)
        setFavoriteKeys(readLocalFavorites())
        setNotice('No pudimos sincronizar tu cuenta. Mostramos los favoritos de este dispositivo.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [isAuthLoading, user])

  const competitions = useMemo(() => {
    const byKey = new Map(
      TOURNAMENT_PAGE_CONFIGS.map((competition) => [
        competition.key,
        competition,
      ])
    )

    return favoriteKeys.map((key) => ({
      key,
      title: byKey.get(key)?.title ?? key,
      country: byKey.get(key)?.country ?? null,
    }))
  }, [favoriteKeys])

  function removeFavorite(key: string) {
    const nextKeys = favoriteKeys.filter((favorite) => favorite !== key)
    setFavoriteKeys(nextKeys)

    if (!user || remoteUserId !== user.id) {
      writeLocalFavorites(nextKeys)
      return
    }

    void toggleFavoriteLeague(user.id, key, true).catch((error: unknown) => {
      console.warn(
        '[favorite-competitions] No se pudo quitar el favorito remoto.',
        getFavoriteLeagueErrorInfo(error)
      )
      setFavoriteKeys(favoriteKeys)
      setNotice('No pudimos guardar el cambio. Intentá nuevamente.')
    })
  }

  if (isLoading || isAuthLoading) {
    return (
      <div className="hf-favorite-competitions-loading" aria-live="polite">
        Cargando competiciones…
      </div>
    )
  }

  return (
    <section className="hf-favorite-competitions">
      <div className="hf-favorites-section-heading">
        <span className="hf-type-overline">Competiciones</span>
        <Link href="/competiciones">Explorar</Link>
      </div>

      {notice ? (
        <p className="hf-favorites-notice" role="status">
          {notice}
        </p>
      ) : null}

      {competitions.length ? (
        <div className="hf-favorite-competition-list">
          {competitions.map((competition) => (
            <div key={competition.key}>
              <Link href={`/liga/${competition.key}`}>
                <strong>{competition.title}</strong>
                <small>
                  {competition.country === 'World'
                    ? 'Internacional'
                    : competition.country || 'Competición'}
                </small>
              </Link>
              <button
                type="button"
                onClick={() => removeFavorite(competition.key)}
                aria-label={`Quitar ${competition.title} de favoritos`}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="hf-favorite-competitions-empty">
          <p>Todavía no seguís ninguna competición.</p>
          <Link href="/competiciones">Elegir competiciones</Link>
        </div>
      )}
    </section>
  )
}
