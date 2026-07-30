'use client'

import Link from 'next/link'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

import { PlayerPhoto, TeamLogo } from '@/frontend/components/AssetImage'
import FavoriteTeamButton from '@/frontend/components/favorites/FavoriteTeamButton'
import AppIcon from '@/frontend/components/navigation/AppIcon'
import Skeleton from '@/frontend/components/ui/Skeleton'
import { useGlobalActionsData } from '@/frontend/hooks/useGlobalActionsData'
import { useSearchCatalog } from '@/frontend/hooks/useSearchCatalog'
import type {
  GlobalActionArticle,
  GlobalActionCompetition,
  GlobalActionMatch,
  GlobalActionPage,
  GlobalActionPlayer,
  GlobalActionTeam,
  GlobalActionTournament,
} from '@/shared/global-actions-data'

type GlobalSearchProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SearchResult =
  | { kind: 'team'; item: GlobalActionTeam }
  | { kind: 'player'; item: GlobalActionPlayer }
  | { kind: 'competition'; item: GlobalActionCompetition }
  | { kind: 'match'; item: GlobalActionMatch }
  | { kind: 'article'; item: GlobalActionArticle }
  | { kind: 'tournament'; item: GlobalActionTournament }
  | { kind: 'page'; item: GlobalActionPage }

type SearchGroup = {
  key: string
  title: string
  items: SearchResult[]
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function matchesQuery(
  query: string,
  values: Array<string | null | undefined>
) {
  const normalizedQuery = normalizeSearch(query)

  return values.some(
    (value) => value && normalizeSearch(value).includes(normalizedQuery)
  )
}

function uniqueTeams(teams: GlobalActionTeam[]) {
  return Array.from(
    new Map(teams.map((team) => [String(team.id), team])).values()
  )
}

function formatTournamentStatus(status: string) {
  if (status === 'active') return 'En juego'
  if (status === 'completed') return 'Finalizado'
  if (status === 'draft') return 'Próximamente'

  return status
}

function TeamResult({
  team,
  onNavigate,
}: {
  team: GlobalActionTeam
  onNavigate: () => void
}) {
  return (
    <div className="hf-search-result-row">
      <Link
        href={team.href}
        onClick={onNavigate}
        data-search-result
      >
        <TeamLogo
          src={team.logoUrl}
          team={{ id: team.id }}
          alt=""
          size={36}
        />
        <span>
          <strong>{team.name}</strong>
          <small>{team.country || 'Equipo'}</small>
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

function ResultLink({
  href,
  icon,
  title,
  detail,
  onNavigate,
}: {
  href: string
  icon: ReactNode
  title: string
  detail: string
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="hf-search-result-link"
      data-search-result
    >
      <span className="hf-search-result-icon" aria-hidden="true">
        {icon}
      </span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <AppIcon name="chevronRight" />
    </Link>
  )
}

function renderResult(
  result: SearchResult,
  onNavigate: () => void
) {
  switch (result.kind) {
    case 'team':
      return (
        <TeamResult
          key={`team-${result.item.id}`}
          team={result.item}
          onNavigate={onNavigate}
        />
      )
    case 'player':
      return (
        <ResultLink
          key={`player-${result.item.id}`}
          href={result.item.href}
          icon={
            <PlayerPhoto
              player={{ id: result.item.id }}
              photoUrl={result.item.photoUrl}
              alt=""
              size={36}
            />
          }
          title={result.item.name}
          detail="Jugador"
          onNavigate={onNavigate}
        />
      )
    case 'competition':
      return (
        <ResultLink
          key={`competition-${result.item.key}`}
          href={result.item.href}
          icon={<AppIcon name="competitions" />}
          title={result.item.title}
          detail={result.item.country || 'Competición'}
          onNavigate={onNavigate}
        />
      )
    case 'match':
      return (
        <ResultLink
          key={`match-${result.item.id}`}
          href={result.item.href}
          icon={<AppIcon name="matches" />}
          title={`${result.item.home} vs ${result.item.away}`}
          detail={`${result.item.displayStatus} · ${result.item.displayTime}${
            result.item.tvLabel ? ` · ${result.item.tvLabel}` : ''
          }`}
          onNavigate={onNavigate}
        />
      )
    case 'article':
      return (
        <ResultLink
          key={`article-${result.item.slug}`}
          href={result.item.href}
          icon={<AppIcon name="news" />}
          title={result.item.title}
          detail={result.item.summary}
          onNavigate={onNavigate}
        />
      )
    case 'tournament':
      return (
        <ResultLink
          key={`tournament-${result.item.id}`}
          href={result.item.href}
          icon={<AppIcon name="tournament" />}
          title={result.item.name}
          detail={[
            'Mi Torneito',
            result.item.city,
            result.item.season,
            formatTournamentStatus(result.item.status),
          ]
            .filter(Boolean)
            .join(' · ')}
          onNavigate={onNavigate}
        />
      )
    case 'page':
      return (
        <ResultLink
          key={`page-${result.item.key}`}
          href={result.item.href}
          icon={<AppIcon name="more" />}
          title={result.item.title}
          detail={result.item.description}
          onNavigate={onNavigate}
        />
      )
  }
}

export default function GlobalSearch({
  open,
  onOpenChange,
}: GlobalSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const { data, isLoading, error } = useGlobalActionsData(open)
  const {
    data: catalog,
    isLoading: isCatalogLoading,
    error: catalogError,
  } = useSearchCatalog(debouncedQuery, open)

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      220
    )

    return () => window.clearTimeout(timeoutId)
  }, [query])

  useEffect(() => {
    if (!open) return

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusInput = () => inputRef.current?.focus({ preventScroll: true })
    focusInput()
    const animationFrameId = window.requestAnimationFrame(focusInput)

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onOpenChange(false)
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      )
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeydown)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeydown)
      previousFocus?.focus({ preventScroll: true })
    }
  }, [onOpenChange, open])

  const groups = useMemo<SearchGroup[]>(() => {
    if (!data) return []

    if (!debouncedQuery) {
      return [
        {
          key: 'teams',
          title: 'Equipos',
          items: data.teams
            .slice(0, 4)
            .map((item) => ({ kind: 'team' as const, item })),
        },
        {
          key: 'competitions',
          title: 'Competiciones',
          items: data.competitions
            .slice(0, 4)
            .map((item) => ({ kind: 'competition' as const, item })),
        },
        {
          key: 'matches',
          title: 'Partidos cercanos',
          items: data.matches
            .slice(0, 4)
            .map((item) => ({ kind: 'match' as const, item })),
        },
        {
          key: 'pages',
          title: 'Accesos rápidos',
          items: data.pages
            .slice(0, 4)
            .map((item) => ({ kind: 'page' as const, item })),
        },
      ]
    }

    const teams = uniqueTeams([
      ...(catalog?.teams ?? []),
      ...data.teams.filter((team) =>
        matchesQuery(debouncedQuery, [team.name, team.country])
      ),
    ]).slice(0, 8)

    return [
      {
        key: 'teams',
        title: 'Equipos y selecciones',
        items: teams.map((item) => ({ kind: 'team' as const, item })),
      },
      {
        key: 'players',
        title: 'Jugadores',
        items: (catalog?.players ?? []).map((item) => ({
          kind: 'player' as const,
          item,
        })),
      },
      {
        key: 'competitions',
        title: 'Competiciones',
        items: data.competitions
          .filter((competition) =>
            matchesQuery(debouncedQuery, [
              competition.title,
              competition.country,
            ])
          )
          .slice(0, 8)
          .map((item) => ({ kind: 'competition' as const, item })),
      },
      {
        key: 'matches',
        title: 'Partidos',
        items: data.matches
          .filter((match) =>
            matchesQuery(debouncedQuery, [
              match.home,
              match.away,
              match.tvLabel,
              match.displayStatus,
            ])
          )
          .slice(0, 8)
          .map((item) => ({ kind: 'match' as const, item })),
      },
      {
        key: 'articles',
        title: 'Noticias',
        items: (catalog?.articles ?? []).map((item) => ({
          kind: 'article' as const,
          item,
        })),
      },
      {
        key: 'tournaments',
        title: 'Mi Torneito',
        items: (catalog?.tournaments ?? []).map((item) => ({
          kind: 'tournament' as const,
          item,
        })),
      },
      {
        key: 'pages',
        title: 'Secciones',
        items: data.pages
          .filter((page) =>
            matchesQuery(debouncedQuery, [page.title, page.description])
          )
          .slice(0, 8)
          .map((item) => ({ kind: 'page' as const, item })),
      },
    ]
  }, [catalog, data, debouncedQuery])

  if (!open) return null

  const resultCount = groups.reduce(
    (count, group) => count + group.items.length,
    0
  )
  const loading = isLoading || isCatalogLoading
  const visibleGroups = groups.filter((group) => group.items.length > 0)
  const onNavigate = () => onOpenChange(false)

  function handleResultsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (
      !panelRef.current ||
      !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
    ) {
      return
    }

    const currentResult = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-search-result]'
    )
    if (!currentResult) return

    const results = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>('[data-search-result]')
    )
    const currentIndex = results.indexOf(currentResult)
    if (currentIndex < 0 || results.length === 0) return

    event.preventDefault()

    if (event.key === 'ArrowUp' && currentIndex === 0) {
      inputRef.current?.focus()
      return
    }

    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? results.length - 1
          : event.key === 'ArrowDown'
            ? Math.min(currentIndex + 1, results.length - 1)
            : Math.max(currentIndex - 1, 0)

    results[nextIndex]?.focus()
  }

  return (
    <div
      className="hf-search-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Buscar en Hay Fulbo"
    >
      <button
        type="button"
        className="hf-search-backdrop"
        aria-label="Cerrar búsqueda"
        onClick={() => onOpenChange(false)}
      />
      <div className="hf-search-panel" ref={panelRef}>
        <header className="hf-search-header">
          <div>
            <span className="hf-type-overline">Todo Hay Fulbo</span>
            <h2>Encontrá lo que querés ver</h2>
          </div>
          <button
            type="button"
            className="hf-search-close"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar búsqueda"
          >
            <AppIcon name="close" />
          </button>
        </header>

        <div className="hf-search-input-row">
          <AppIcon name="search" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowDown' || !panelRef.current) return

              const firstResult =
                panelRef.current.querySelector<HTMLElement>(
                  '[data-search-result]'
                )
              if (!firstResult) return

              event.preventDefault()
              firstResult.focus()
            }}
            placeholder="Equipos, jugadores, partidos, noticias..."
            aria-label="Buscar"
            aria-describedby="hf-search-summary"
          />
          {query ? (
            <button
              type="button"
              className="hf-search-clear"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              aria-label="Limpiar búsqueda"
            >
              Limpiar
            </button>
          ) : (
            <kbd>Esc</kbd>
          )}
        </div>

        <p
          id="hf-search-summary"
          className="hf-sr-only"
          role="status"
          aria-live="polite"
        >
          {loading
            ? 'Buscando'
            : `${resultCount} ${
                resultCount === 1 ? 'resultado' : 'resultados'
              }`}
        </p>

        <div
          className="hf-search-results"
          aria-busy={loading}
          aria-label="Resultados de búsqueda"
          onKeyDown={handleResultsKeyDown}
        >
          {loading ? (
            <div className="hf-search-loading" aria-label="Buscando">
              <Skeleton height="4rem" />
              <Skeleton height="4rem" />
              <Skeleton height="4rem" />
            </div>
          ) : null}

          {!loading && (error || catalogError) ? (
            <div className="hf-search-notice" role="alert">
              <AppIcon name="info" />
              <span>
                {error || catalogError} Podés seguir usando los resultados
                disponibles.
              </span>
            </div>
          ) : null}

          {!loading && catalog?.partial ? (
            <div className="hf-search-notice" role="status">
              <AppIcon name="info" />
              <span>
                Algunos resultados no están disponibles en este momento.
              </span>
            </div>
          ) : null}

          {!loading && resultCount === 0 ? (
            <div className="hf-search-empty">
              <AppIcon name="search" />
              <strong>Sin resultados</strong>
              <p>
                Probá con otro nombre, revisá la escritura o usá una palabra
                más corta.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : null}

          {!loading
            ? visibleGroups.map((group) => (
                <section key={group.key} className="hf-search-group">
                  <h3>
                    <span>{group.title}</span>
                    <small>{group.items.length}</small>
                  </h3>
                  <div>
                    {group.items.map((result) =>
                      renderResult(result, onNavigate)
                    )}
                  </div>
                </section>
              ))
            : null}
        </div>
      </div>
    </div>
  )
}
