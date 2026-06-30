'use client'

import { useState } from 'react'

import FavoriteTeamsList from '@/frontend/components/favorites/FavoriteTeamsList'
import GlobalSearch from '@/frontend/components/global/GlobalSearch'

export default function TeamsPageClient() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  return (
    <main className="hf-directory-page">
      <section className="hf-directory-hero">
        <p>Equipos</p>
        <h1>Tus equipos favoritos</h1>
        <span>Buscá equipos, abrilos y marcá favoritos para tenerlos siempre en la sidebar.</span>
      </section>

      <section className="hf-directory-section">
        <div className="hf-directory-section-head">
          <h2>Mi equipo</h2>
          <button
            type="button"
            className="hf-directory-action"
            onClick={() => setIsSearchOpen(true)}
          >
            Buscar equipo
          </button>
        </div>
        <FavoriteTeamsList onOpenSearch={() => setIsSearchOpen(true)} />
      </section>

      <GlobalSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </main>
  )
}
