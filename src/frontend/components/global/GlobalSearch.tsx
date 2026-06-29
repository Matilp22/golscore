'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import FavoriteTeamButton from '@/frontend/components/favorites/FavoriteTeamButton'
import { TeamLogo } from '@/frontend/components/AssetImage'
import { useGlobalActionsData } from '@/frontend/hooks/useGlobalActionsData'
import type {
  GlobalActionCompetition,
  GlobalActionMatch,
  GlobalActionPage,
  GlobalActionTeam,
} from '@/shared/global-actions-data'

type GlobalSearchProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ResultGroup<T> = {
  key: string
  title: string
  items: T[]
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function matchesQuery(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = normalizeSearch(query)

  return values.some((value) => value && normalizeSearch(value).includes(normalizedQuery))
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function TeamResult({ team, onNavigate }: { team: GlobalActionTeam; onNavigate: () => void }) {
  return (
    <div className="hf-search-result-row">
      <Link href={team.href} onClick={onNavigate}>
        <TeamLogo src={team.logoUrl} alt={team.name} size={28} className="h-full w-full object-contain" />
        <span>
          <strong>{team.name}</strong>
          {team.country ? <small>{team.country}</small> : null}
        </span>
      </Link>
      <FavoriteTeamButton
        compact
        team={{
          id: team.id,
          name: team.name,
          logoUrl: team.logoUrl,
          country: team.country,
          href: team.href,
        }}
      />
    </div>
  )
}

function CompetitionResult({ competition, onNavigate }: { competition: GlobalActionCompetition; onNavigate: () => void }) {
  return (
    <Link href={competition.href} onClick={onNavigate} className="hf-search-result-link">
      <span className="hf-search-result-icon">C</span>
      <span>
        <strong>{competition.title}</strong>
        {competition.country ? <small>{competition.country}</small> : null}
      </span>
    </Link>
  )
}

function MatchResult({ match, onNavigate }: { match: GlobalActionMatch; onNavigate: () => void }) {
  return (
    <Link href={match.href} onClick={onNavigate} className="hf-search-result-link">
      <span className="hf-search-result-icon">P</span>
      <span>
        <strong>{match.home} vs {match.away}</strong>
        <small>
          {match.displayTime}
          {match.tvLabel ? ` · ${match.tvLabel}` : ''}
        </small>
      </span>
    </Link>
  )
}

function PageResult({ page, onNavigate }: { page: GlobalActionPage; onNavigate: () => void }) {
  return (
    <Link href={page.href} onClick={onNavigate} className="hf-search-result-link">
      <span className="hf-search-result-icon">HF</span>
      <span>
        <strong>{page.title}</strong>
        <small>{page.description}</small>
      </span>
    </Link>
  )
}

export default function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const { data, isLoading, error } = useGlobalActionsData(open)

  useEffect(() => {
    if (!open) return

    const focusInput = () => inputRef.current?.focus({ preventScroll: true })
    focusInput()
    const animationFrameId = window.requestAnimationFrame(focusInput)
    const timeoutId = window.setTimeout(focusInput, 90)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.clearTimeout(timeoutId)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('keydown', handleKeydown)

    return () => document.removeEventListener('keydown', handleKeydown)
  }, [onOpenChange, open])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)

    return () => window.clearTimeout(timeoutId)
  }, [query])

  const groups = useMemo(() => {
    const emptyGroups: Array<ResultGroup<unknown>> = [
      { key: 'teams', title: 'Equipos', items: [] },
      { key: 'competitions', title: 'Competiciones', items: [] },
      { key: 'matches', title: 'Partidos', items: [] },
      { key: 'pages', title: 'Paginas', items: [] },
    ]

    if (!data) return emptyGroups

    if (!debouncedQuery) {
      return [
        { key: 'teams', title: 'Equipos', items: data.teams.slice(0, 4) },
        { key: 'competitions', title: 'Competiciones', items: data.competitions.slice(0, 4) },
        { key: 'matches', title: 'Partidos', items: data.matches.slice(0, 4) },
        { key: 'pages', title: 'Paginas', items: data.pages.slice(0, 4) },
      ]
    }

    return [
      {
        key: 'teams',
        title: 'Equipos',
        items: data.teams
          .filter((team) => matchesQuery(debouncedQuery, [team.name, team.country]))
          .slice(0, 6),
      },
      {
        key: 'competitions',
        title: 'Competiciones',
        items: data.competitions
          .filter((competition) => matchesQuery(debouncedQuery, [competition.title, competition.country]))
          .slice(0, 6),
      },
      {
        key: 'matches',
        title: 'Partidos',
        items: data.matches
          .filter((match) => matchesQuery(debouncedQuery, [match.home, match.away, match.tvLabel, match.displayStatus]))
          .slice(0, 6),
      },
      {
        key: 'pages',
        title: 'Paginas',
        items: data.pages
          .filter((page) => matchesQuery(debouncedQuery, [page.title, page.description]))
          .slice(0, 6),
      },
    ]
  }, [data, debouncedQuery])

  if (!open) return null

  const onNavigate = () => onOpenChange(false)
  const resultCount = groups.reduce((count, group) => count + group.items.length, 0)

  return (
    <div className="hf-search-modal" role="dialog" aria-modal="true" aria-label="Buscar en Hay Fulbo">
      <button
        type="button"
        className="hf-search-backdrop"
        aria-label="Cerrar busqueda"
        onClick={() => onOpenChange(false)}
      />
      <div className="hf-search-panel" ref={panelRef}>
        <div className="hf-search-input-row">
          <SearchIcon />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar equipos, partidos, competiciones..."
            aria-label="Buscar"
          />
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Cerrar busqueda">
            <CloseIcon />
          </button>
        </div>

        <div className="hf-search-results">
          {isLoading ? <div className="hf-search-empty">Cargando busqueda...</div> : null}
          {error ? <div className="hf-search-empty">{error}</div> : null}
          {!isLoading && !error && resultCount === 0 ? (
            <div className="hf-search-empty">No encontramos resultados para esa busqueda.</div>
          ) : null}
          {!isLoading && !error
            ? groups.map((group) => {
                if (!group.items.length) return null

                return (
                  <section key={group.key} className="hf-search-group">
                    <h3>{group.title}</h3>
                    <div>
                      {group.key === 'teams'
                        ? (group.items as GlobalActionTeam[]).map((team) => (
                            <TeamResult key={team.id} team={team} onNavigate={onNavigate} />
                          ))
                        : null}
                      {group.key === 'competitions'
                        ? (group.items as GlobalActionCompetition[]).map((competition) => (
                            <CompetitionResult
                              key={competition.key}
                              competition={competition}
                              onNavigate={onNavigate}
                            />
                          ))
                        : null}
                      {group.key === 'matches'
                        ? (group.items as GlobalActionMatch[]).map((match) => (
                            <MatchResult key={match.id} match={match} onNavigate={onNavigate} />
                          ))
                        : null}
                      {group.key === 'pages'
                        ? (group.items as GlobalActionPage[]).map((page) => (
                            <PageResult key={page.key} page={page} onNavigate={onNavigate} />
                          ))
                        : null}
                    </div>
                  </section>
                )
              })
            : null}
        </div>
      </div>
    </div>
  )
}
