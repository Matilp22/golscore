'use client'

import Link from 'next/link'

import { TeamLogo } from '@/frontend/components/AssetImage'
import { useFavoriteTeams } from '@/frontend/hooks/useFavoriteTeams'

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m12 3.5 2.6 5.25 5.8.85-4.2 4.1 1 5.8-5.2-2.75L6.8 19.5l1-5.8-4.2-4.1 5.8-.85L12 3.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function HomeFavoritesStrip() {
  const { favorites, removeFavorite } = useFavoriteTeams()

  return (
    <section className="hf-matchday-favorites" aria-labelledby="home-favorites-title">
      <header>
        <div>
          <span className="hf-type-overline">Tu cancha</span>
          <h2 id="home-favorites-title">Favoritos</h2>
        </div>
        <Link href="/equipos">Explorar equipos</Link>
      </header>

      {favorites.length ? (
        <div className="hf-matchday-favorite-list">
          {favorites.map((team) => (
            <div key={team.id} className="hf-matchday-favorite">
              <Link href={team.href || `/equipo/${team.id}`}>
                <TeamLogo
                  src={team.logoUrl}
                  team={{ id: team.id }}
                  alt=""
                  size={32}
                />
                <span>{team.name}</span>
              </Link>
              <button
                type="button"
                onClick={() => removeFavorite(team.id)}
                aria-label={`Quitar ${team.name} de favoritos`}
                title="Quitar favorito"
              >
                <StarIcon />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="hf-matchday-favorites-empty">
          <StarIcon />
          <p>
            Seguí equipos y selecciones para encontrarlos más rápido desde
            cualquier pantalla.
          </p>
          <Link href="/equipos">Elegir favoritos</Link>
        </div>
      )}
    </section>
  )
}
