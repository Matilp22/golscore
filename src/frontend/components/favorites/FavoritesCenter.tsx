'use client'

import FavoriteCompetitionsList from '@/frontend/components/favorites/FavoriteCompetitionsList'
import FavoriteTeamsList from '@/frontend/components/favorites/FavoriteTeamsList'

type FavoritesCenterProps = {
  onOpenSearch: () => void
}

export default function FavoritesCenter({ onOpenSearch }: FavoritesCenterProps) {
  return (
    <div className="hf-favorites-center">
      <section>
        <div className="hf-favorites-section-heading">
          <span className="hf-type-overline">Equipos</span>
          <button type="button" onClick={onOpenSearch}>
            Buscar
          </button>
        </div>
        <FavoriteTeamsList onOpenSearch={onOpenSearch} />
      </section>

      <FavoriteCompetitionsList />

      <p className="hf-favorites-persistence">
        Los equipos se guardan en este dispositivo. Las competiciones se
        sincronizan con tu cuenta cuando iniciás sesión y, si no, quedan locales.
      </p>
    </div>
  )
}
