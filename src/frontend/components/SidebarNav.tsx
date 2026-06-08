'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import ChampionsEntrySoundLink from '@/frontend/components/ChampionsEntrySoundLink'
import { useAuth } from '@/frontend/hooks/useAuth'
import {
  getFavoriteLeagueErrorInfo,
  getUserFavoriteLeagues,
  toggleFavoriteLeague,
} from '@/frontend/services/favoriteLeaguesService'
import type { SidebarSectionConfig, TournamentPageConfig } from '@/lib/tournament-pages'
import {
  getSectionDisplayName,
  getTournamentDisplayName,
  t,
  type AppLocale,
} from '@/shared/i18n/locales'
import { isExcludedCompetition } from '@/shared/utils/competition-filter'

type SidebarNavProps = {
  sections: SidebarSectionConfig[]
  activeSectionKey?: string
  highlightedTournamentKeys?: string[]
  compact?: boolean
  locale: AppLocale
  onNavigate?: () => void
}

const FAVORITES_STORAGE_KEY = 'fulboapp:favorites:v1'
const LEGACY_FAVORITES_STORAGE_KEY = ['gol', 'score:favorites:v1'].join('')

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
    const storedFavorites =
      window.localStorage.getItem(FAVORITES_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_FAVORITES_STORAGE_KEY) ??
      '[]'
    const parsed = JSON.parse(storedFavorites)

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function writeLocalFavorites(favorites: string[]) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
}

export default function SidebarNav({
  sections,
  highlightedTournamentKeys = [],
  compact = false,
  locale,
  onNavigate,
}: SidebarNavProps) {
  const { user } = useAuth()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>([])
  const [remoteFavoriteUserId, setRemoteFavoriteUserId] = useState<string | null>(null)
  const highlighted = new Set(highlightedTournamentKeys)
  const visibleSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          tournaments: section.tournaments.filter(
            (tournament) => !isExcludedCompetition(tournament)
          ),
        }))
        .filter((section) => section.tournaments.length > 0),
    [sections]
  )

  const tournamentsByKey = useMemo(() => {
    return new Map(
      visibleSections.flatMap((section) =>
        section.tournaments.map((tournament) => [tournament.key, tournament] as const)
      )
    )
  }, [visibleSections])

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
        console.warn(
          '[sidebar-favorites] No se pudieron cargar favoritos; usando favoritos locales.',
          getFavoriteLeagueErrorInfo(error)
        )
        if (!active) return

        setRemoteFavoriteUserId(null)
        setFavoriteKeys(readFavorites())
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

    if (!user || remoteFavoriteUserId !== user.id) {
      const nextFavorites = wasFavorite
        ? favoriteKeys.filter((key) => key !== tournamentKey)
        : Array.from(new Set([...favoriteKeys, tournamentKey]))

      writeLocalFavorites(nextFavorites)
      return
    }

    void toggleFavoriteLeague(user.id, tournamentKey, wasFavorite).catch((error: unknown) => {
      console.warn(
        '[sidebar-favorites] No se pudo actualizar favorito en Supabase; usando favoritos locales.',
        getFavoriteLeagueErrorInfo(error)
      )
      setRemoteFavoriteUserId(null)

      const nextFavorites = wasFavorite
        ? favoriteKeys.filter((key) => key !== tournamentKey)
        : Array.from(new Set([...favoriteKeys, tournamentKey]))

      setFavoriteKeys(nextFavorites)
      writeLocalFavorites(nextFavorites)
    })
  }

  function renderTournament(tournament: TournamentPageConfig) {
    const isFavorite = favoriteKeys.includes(tournament.key)
    const isHighlighted = highlighted.has(tournament.key)
    const linkClassName = 'min-w-0 flex-1 truncate px-2.5 py-2 text-sm'
    const href = `/liga/${tournament.key}`
    const tournamentTitle = getTournamentDisplayName(tournament.key, tournament.title, locale)

    return (
      <div key={tournament.key} className={`group flex min-w-0 items-center gap-1 rounded-xl transition ${isHighlighted ? 'bg-[#70ff9d]/10 text-[#eaffef] shadow-[inset_0_0_0_1px_rgba(112,255,157,0.16)]' : 'text-[#bcc6d2] hover:bg-[#70ff9d]/10 hover:text-white'}`}>
        {tournament.key === 'internacional-champions' ? (
          <ChampionsEntrySoundLink
            href={href}
            tournamentKey={tournament.key}
            onClick={onNavigate}
            className={linkClassName}
          >
            {tournamentTitle}
          </ChampionsEntrySoundLink>
        ) : (
          <Link href={href} onClick={onNavigate} className={linkClassName}>
            {tournamentTitle}
          </Link>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            toggleFavorite(tournament.key)
          }}
          className="mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition hover:bg-white/8"
          aria-label={t(locale, isFavorite ? 'nav.removeFavorite' : 'nav.addFavorite', {
            name: tournamentTitle,
          })}
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
      title: t(locale, 'nav.favorites'),
      tournaments: favoriteTournaments,
      isFavorites: true,
    },
    ...visibleSections.map((section) => ({ ...section, isFavorites: false })),
  ]

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {allSections.map((section) => {
        const isOpen = openSections[section.key] ?? false

        return (
          <div key={section.key} className={`overflow-hidden border border-[#70ff9d]/10 bg-[#0b1412]/90 shadow-[0_8px_24px_rgba(0,0,0,0.14)] ${compact ? 'rounded-xl' : 'rounded-2xl'}`}>
            <button type="button" onClick={() => toggleSection(section.key)} className={`flex w-full min-w-0 items-center justify-between gap-2 text-left transition hover:bg-[#70ff9d]/10 ${compact ? 'px-3 py-2' : 'px-3.5 py-2.5'}`} aria-expanded={isOpen}>
              <span className="min-w-0 truncate text-sm font-semibold text-[#e4ebf3]">
                {section.isFavorites
                  ? section.title
                  : getSectionDisplayName(section.key, section.title, locale)}
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
                      {t(locale, 'nav.noFavorites')}
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
