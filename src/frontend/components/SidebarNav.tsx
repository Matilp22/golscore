'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/frontend/hooks/useAuth'
import {
  getUserFavoriteLeagues,
  toggleFavoriteLeague,
} from '@/frontend/services/favoriteLeaguesService'
import type { SidebarSectionConfig, TournamentPageConfig } from '@/lib/tournament-pages'

type SidebarNavProps = {
  sections: SidebarSectionConfig[]
  activeSectionKey?: string
  highlightedTournamentKeys?: string[]
  compact?: boolean
  onNavigate?: () => void
}

const FAVORITES_STORAGE_KEY = 'golscore:favorites:v1'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
      <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-4 w-4 ${filled ? 'text-[#f7c948]' : 'text-[#8d98a7]'}`} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3.6 2.45 5.03 5.55.8-4.02 3.9.95 5.52L12 16.25l-4.93 2.6.95-5.52L4 9.43l5.55-.8L12 3.6Z" />
    </svg>
  )
}

function readFavorites() {
  if (typeof window === 'undefined') return []

  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]')

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

export default function SidebarNav({
  sections,
  highlightedTournamentKeys = [],
  compact = false,
  onNavigate,
}: SidebarNavProps) {
  const { user } = useAuth()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>([])
  const [remoteFavoriteUserId, setRemoteFavoriteUserId] = useState<string | null>(null)
  const highlighted = new Set(highlightedTournamentKeys)

  const tournamentsByKey = useMemo(() => {
    return new Map(
      sections.flatMap((section) =>
        section.tournaments.map((tournament) => [tournament.key, tournament] as const)
      )
    )
  }, [sections])

  const favoriteTournaments = favoriteKeys
    .map((key) => tournamentsByKey.get(key))
    .filter((tournament): tournament is TournamentPageConfig => Boolean(tournament))

  useEffect(() => {
    queueMicrotask(() => {
      if (!user) {
        setRemoteFavoriteUserId(null)
        setFavoriteKeys(readFavorites())
      }
    })
  }, [user])

  useEffect(() => {
    if (typeof window === 'undefined' || user) return

    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteKeys))
  }, [favoriteKeys, user])

  useEffect(() => {
    if (!user) return

    let active = true

    getUserFavoriteLeagues(user.id)
      .then((favorites) => {
        if (!active) return

        setRemoteFavoriteUserId(user.id)
        setFavoriteKeys(favorites)
      })
      .catch((error: unknown) => {
        console.error('[sidebar-favorites] No se pudieron cargar favoritos', error)
        if (!active) return

        setRemoteFavoriteUserId(user.id)
        setFavoriteKeys([])
      })

    return () => {
      active = false
    }
  }, [user])

  function toggleSection(sectionKey: string) {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }))
  }

  function toggleFavorite(tournamentKey: string) {
    const wasFavorite = favoriteKeys.includes(tournamentKey)

    setFavoriteKeys((current) =>
      wasFavorite
        ? current.filter((key) => key !== tournamentKey)
        : [...current, tournamentKey]
    )

    if (!user || remoteFavoriteUserId !== user.id) return

    void toggleFavoriteLeague(user.id, tournamentKey, wasFavorite).catch((error: unknown) => {
      console.error('[sidebar-favorites] No se pudo actualizar favorito', error)
      setFavoriteKeys((current) =>
        wasFavorite
          ? Array.from(new Set([...current, tournamentKey]))
          : current.filter((key) => key !== tournamentKey)
      )
    })
  }

  function renderTournament(tournament: TournamentPageConfig) {
    const isFavorite = favoriteKeys.includes(tournament.key)
    const isHighlighted = highlighted.has(tournament.key)

    return (
      <div key={tournament.key} className={`group flex min-w-0 items-center gap-1 rounded-lg transition ${isHighlighted ? 'bg-[#152a20] text-[#dfffe9] shadow-[inset_0_0_0_1px_rgba(127,240,178,0.13)]' : 'text-[#bcc6d2] hover:bg-white/5 hover:text-white'}`}>
        <Link href={`/liga/${tournament.key}`} onClick={onNavigate} className="min-w-0 flex-1 truncate px-2.5 py-2 text-sm">
          {tournament.title}
        </Link>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            toggleFavorite(tournament.key)
          }}
          className="mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition hover:bg-white/8"
          aria-label={isFavorite ? `Quitar ${tournament.title} de favoritos` : `Agregar ${tournament.title} a favoritos`}
          aria-pressed={isFavorite}
        >
          <StarIcon filled={isFavorite} />
        </button>
      </div>
    )
  }

  const allSections = [
    {
      key: 'favorites',
      title: 'Mis favoritos',
      tournaments: favoriteTournaments,
      isFavorites: true,
    },
    ...sections.map((section) => ({ ...section, isFavorites: false })),
  ]

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {allSections.map((section) => {
        const isOpen = openSections[section.key] ?? false

        return (
          <div key={section.key} className={`overflow-hidden border border-white/7 bg-[#111418] shadow-[0_8px_24px_rgba(0,0,0,0.10)] ${compact ? 'rounded-xl' : 'rounded-2xl'}`}>
            <button type="button" onClick={() => toggleSection(section.key)} className={`flex w-full min-w-0 items-center justify-between gap-2 text-left transition hover:bg-white/[0.04] ${compact ? 'px-3 py-2' : 'px-3.5 py-2.5'}`} aria-expanded={isOpen}>
              <span className="min-w-0 truncate text-sm font-semibold text-[#e4ebf3]">
                {section.title}
              </span>
              <Chevron open={isOpen} />
            </button>

            <div className="grid transition-[grid-template-rows,opacity] duration-200" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', opacity: isOpen ? 1 : 0 }}>
              <div className="overflow-hidden">
                <div className="border-t border-white/6 px-2 pb-2 pt-1">
                  {section.tournaments.length ? (
                    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
                      {section.tournaments.map(renderTournament)}
                    </div>
                  ) : section.isFavorites ? (
                    <p className="px-2 py-2 text-xs leading-5 text-[#8d98a7]">
                      Todavía no agregaste favoritos.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
