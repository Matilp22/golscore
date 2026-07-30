'use client'

import { useState } from 'react'

import FavoriteTeamsList from '@/frontend/components/favorites/FavoriteTeamsList'
import GlobalSearch from '@/frontend/components/global/GlobalSearch'

export default function TeamsPageClient() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  return (
    <main className="hf-teams-hub">
      <header className="hf-teams-hub-hero">
        <div>
          <p className="hf-type-overline">Tu tribuna</p>
          <h1>Equipos que seguís</h1>
          <p>Guardá clubes y selecciones para encontrarlos rápido desde cualquier pantalla.</p>
        </div>
        <button type="button" className="hf-button" onClick={() => setIsSearchOpen(true)}>
          Buscar equipo
        </button>
      </header>

      <section className="hf-entity-panel">
        <header className="hf-entity-panel-heading">
          <div>
            <p className="hf-type-overline">Favoritos</p>
            <h2>Mis equipos</h2>
          </div>
          <button
            type="button"
            className="hf-button-secondary"
            onClick={() => setIsSearchOpen(true)}
          >
            Agregar
          </button>
        </header>
        <div className="hf-teams-hub-list">
          <FavoriteTeamsList onOpenSearch={() => setIsSearchOpen(true)} />
        </div>
      </section>

      <GlobalSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </main>
  )
}
