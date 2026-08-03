'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { MiTorneitoTournament } from '@/shared/mi-torneito/types'
import { MiTorneitoTournamentCard } from './MiTorneitoPublicViews'

function normalize(value: string) {
  return value
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export default function MiTorneitoUtilityLanding({
  tournaments,
}: {
  tournaments: MiTorneitoTournament[]
}) {
  const [query, setQuery] = useState('')
  const visibleTournaments = useMemo(() => {
    const term = normalize(query)
    if (!term) return tournaments

    return tournaments.filter((tournament) =>
      normalize(`${tournament.name} ${tournament.city ?? ''}`).includes(term)
    )
  }, [query, tournaments])

  return (
    <main className="hf-mi-page hf-mi-utility-page">
      <header className="hf-mi-utility-header">
        <div>
          <p className="hf-mi-kicker">Torneos de tu comunidad</p>
          <h1>Mi Torneito</h1>
          <p>Buscá una competencia y entrá directo a su fixture, tabla, equipos y resultados.</p>
        </div>
        <Link href="/mi-torneito/como-funciona" className="hf-mi-secondary-button">
          Cómo funciona
        </Link>
      </header>

      <section className="hf-mi-tournament-browser" aria-labelledby="mi-torneito-browser-title">
        <div className="hf-mi-section-head">
          <div>
            <p className="hf-mi-kicker">Encontrá tu torneo</p>
            <h2 id="mi-torneito-browser-title">Torneos publicados</h2>
          </div>
          <span>{visibleTournaments.length}</span>
        </div>

        <label className="hf-mi-search">
          <span className="hf-sr-only">Buscar torneo por nombre o ciudad</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre del torneo o ciudad"
            autoFocus
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda">×</button>
          ) : null}
        </label>

        {visibleTournaments.length ? (
          <div className="hf-mi-card-grid">
            {visibleTournaments.map((tournament) => (
              <MiTorneitoTournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        ) : (
          <div className="hf-mi-empty" role="status">
            <strong>No encontramos ese torneo</strong>
            <span>Probá con otro nombre o ciudad.</span>
          </div>
        )}
      </section>
    </main>
  )
}
