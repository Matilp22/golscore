'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/frontend/hooks/useAuth'
import {
  getSidebarNavigationItems,
  type SidebarNavigationGroup,
} from '@/frontend/navigation/sidebar-navigation'
import {
  getFavoriteLeagueErrorInfo,
  getUserFavoriteLeagues,
  toggleFavoriteLeague,
} from '@/frontend/services/favoriteLeaguesService'
import type {
  SidebarSectionConfig,
  TournamentPageConfig,
} from '@/lib/tournament-pages'
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
  showEditorial?: boolean
}

const FAVORITES_STORAGE_KEY = 'fulboapp:favorites:v1'
const LEGACY_FAVORITES_STORAGE_KEY = ['gol', 'score:favorites:v1'].join('')

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={open ? 'is-open' : ''}
    >
      <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m12 3.6 2.45 5.03 5.55.8-4.02 3.9.95 5.52L12 16.25l-4.93 2.6.95-5.52L4 9.43l5.55-.8L12 3.6Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  activeSectionKey,
  highlightedTournamentKeys = [],
  compact = false,
  locale,
  onNavigate,
  showEditorial = true,
}: SidebarNavProps) {
  const { user } = useAuth()
  const pathname = usePathname()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>([])
  const [remoteFavoriteUserId, setRemoteFavoriteUserId] = useState<
    string | null
  >(null)
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
  const tournamentsByKey = useMemo(
    () =>
      new Map(
        visibleSections.flatMap((section) =>
          section.tournaments.map(
            (tournament) => [tournament.key, tournament] as const
          )
        )
      ),
    [visibleSections]
  )
  const favoriteTournaments = favoriteKeys
    .map((key) => tournamentsByKey.get(key))
    .filter(
      (tournament): tournament is TournamentPageConfig =>
        Boolean(tournament)
    )

  useEffect(() => {
    queueMicrotask(() => {
      if (user) return
      setRemoteFavoriteUserId(null)
      setFavoriteKeys(readFavorites())
    })
  }, [user])

  useEffect(() => {
    if (typeof window === 'undefined' || user) return
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(favoriteKeys)
    )
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
    const nextFavorites = wasFavorite
      ? favoriteKeys.filter((key) => key !== tournamentKey)
      : Array.from(new Set([...favoriteKeys, tournamentKey]))

    setFavoriteKeys(nextFavorites)

    if (!user || remoteFavoriteUserId !== user.id) {
      writeLocalFavorites(nextFavorites)
      return
    }

    void toggleFavoriteLeague(user.id, tournamentKey, wasFavorite).catch(
      (error: unknown) => {
        console.warn(
          '[sidebar-favorites] No se pudo actualizar favorito en Supabase; usando favoritos locales.',
          getFavoriteLeagueErrorInfo(error)
        )
        setRemoteFavoriteUserId(null)
        setFavoriteKeys(nextFavorites)
        writeLocalFavorites(nextFavorites)
      }
    )
  }

  function renderTournament(tournament: TournamentPageConfig) {
    const isFavorite = favoriteKeys.includes(tournament.key)
    const href = `/liga/${tournament.key}`
    const isCurrent =
      pathname === href || pathname?.startsWith(`${href}/`) || false
    const isHighlighted = highlighted.has(tournament.key) || isCurrent
    const title = getTournamentDisplayName(
      tournament.key,
      tournament.title,
      locale
    )

    return (
      <div
        key={tournament.key}
        className={`hf-competition-browser-item ${isHighlighted ? 'is-active' : ''}`}
      >
        <Link
          href={href}
          onClick={onNavigate}
          prefetch={false}
          aria-current={isCurrent ? 'page' : undefined}
        >
          {title}
        </Link>
        <button
          type="button"
          onClick={() => toggleFavorite(tournament.key)}
          aria-label={t(
            locale,
            isFavorite ? 'nav.removeFavorite' : 'nav.addFavorite',
            { name: title }
          )}
          aria-pressed={isFavorite}
          className={isFavorite ? 'is-favorite' : ''}
        >
          <StarIcon filled={isFavorite} />
        </button>
      </div>
    )
  }

  const navigationItems = getSidebarNavigationItems({
    sections: visibleSections,
    favoriteTournaments,
    favoritesLabel: t(locale, 'nav.favorites'),
  }).filter((item) => showEditorial || item.type !== 'editorial')

  function renderEditorialItem(item: SidebarNavigationGroup) {
    const active =
      pathname === item.href || pathname?.startsWith(`${item.href}/`) || false

    return (
      <Link
        key={item.key}
        href={item.href}
        onClick={onNavigate}
        prefetch={false}
        className={`hf-competition-editorial ${active ? 'is-active' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        {item.icon}
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <div
      className={`hf-competition-browser ${compact ? 'is-compact' : ''}`}
    >
      {navigationItems.map((item) => {
        if (item.type === 'editorial') return renderEditorialItem(item)

        const open =
          openSections[item.key] ??
          (item.key === activeSectionKey ||
            item.tournaments.some((tournament) => {
              const href = `/liga/${tournament.key}`
              return pathname === href || pathname?.startsWith(`${href}/`)
            }))
        const isFavorites = item.type === 'favorite'
        const label = isFavorites
          ? item.label
          : getSectionDisplayName(item.key, item.label, locale)

        return (
          <section key={item.key} className="hf-competition-browser-group">
            <button
              type="button"
              className="hf-competition-browser-trigger"
              onClick={() => toggleSection(item.key)}
              aria-expanded={open}
            >
              <span>{label}</span>
              <Chevron open={open} />
            </button>

            {open ? (
              <div className="hf-competition-browser-list">
                {item.tournaments.length ? (
                  item.tournaments.map(renderTournament)
                ) : isFavorites ? (
                  <p>{t(locale, 'nav.noFavorites')}</p>
                ) : null}
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
