'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import FavoriteCompetitionButton from '@/frontend/components/favorites/FavoriteCompetitionButton'

export type CompetitionDirectoryItem = {
  key: string
  name: string
  href: string
  logo?: string | null
  initials: string
}

export type CompetitionDirectorySection = {
  key: string
  name: string
  items: CompetitionDirectoryItem[]
}

type CompetitionDirectoryProps = {
  eyebrow: string
  title: string
  description: string
  searchLabel: string
  searchPlaceholder: string
  emptyMessage: string
  sections: CompetitionDirectorySection[]
}

function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export default function CompetitionDirectory({
  eyebrow,
  title,
  description,
  searchLabel,
  searchPlaceholder,
  emptyMessage,
  sections,
}: CompetitionDirectoryProps) {
  const [query, setQuery] = useState('')
  const normalizedQuery = normalizeSearchValue(query)
  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return sections

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          normalizeSearchValue(`${item.name} ${section.name}`).includes(normalizedQuery)
        ),
      }))
      .filter((section) => section.items.length > 0)
  }, [normalizedQuery, sections])
  const total = sections.reduce((count, section) => count + section.items.length, 0)
  const visibleTotal = visibleSections.reduce(
    (count, section) => count + section.items.length,
    0
  )

  return (
    <main className="hf-competition-directory">
      <header className="hf-competition-directory-hero">
        <div>
          <p className="hf-type-overline">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <div className="hf-competition-directory-stat" aria-label={`${total} competiciones`}>
          <strong>{total}</strong>
          <span>torneos disponibles</span>
        </div>
      </header>

      <div className="hf-competition-directory-tools">
        <label className="hf-competition-directory-search">
          <span>{searchLabel}</span>
          <span className="hf-competition-directory-search-control">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="6" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
            />
            {query ? (
              <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda">
                ×
              </button>
            ) : null}
          </span>
        </label>

        <nav aria-label="Regiones de competiciones">
          {sections.map((section) => (
            <a key={section.key} href={`#${section.key}`}>
              {section.name}
            </a>
          ))}
        </nav>
      </div>

      <p className="hf-competition-directory-result" aria-live="polite">
        {normalizedQuery
          ? `${visibleTotal} ${visibleTotal === 1 ? 'resultado' : 'resultados'} para “${query.trim()}”`
          : 'Explorá por país o región'}
      </p>

      {visibleSections.length ? (
        <div className="hf-competition-directory-sections">
          {visibleSections.map((section) => (
            <section key={section.key} id={section.key} className="hf-competition-directory-section">
              <header>
                <h2>{section.name}</h2>
                <span>{section.items.length}</span>
              </header>

              <div className="hf-competition-directory-grid">
                {section.items.map((item) => (
                  <article key={item.key} className="hf-competition-directory-card-shell">
                    <Link
                      href={item.href}
                      prefetch={false}
                      className="hf-competition-directory-card"
                    >
                      {item.logo ? (
                        <span className="hf-competition-directory-logo">
                          <Image
                            src={item.logo}
                            alt=""
                            width={48}
                            height={48}
                            className="h-12 w-12 object-contain"
                          />
                        </span>
                      ) : (
                        <span className="hf-competition-directory-monogram" aria-hidden="true">
                          {item.initials}
                        </span>
                      )}
                      <span>{item.name}</span>
                    </Link>
                    <FavoriteCompetitionButton
                      leagueKey={item.key}
                      leagueName={item.name}
                      className="is-icon-only"
                    />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="hf-state-surface" role="status">
          <span className="hf-state-surface-icon" aria-hidden="true">?</span>
          <h2>Sin coincidencias</h2>
          <p>{emptyMessage}</p>
          <button type="button" className="hf-button-secondary" onClick={() => setQuery('')}>
            Ver todas
          </button>
        </section>
      )}
    </main>
  )
}
