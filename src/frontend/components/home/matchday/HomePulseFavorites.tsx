'use client'

import Link from 'next/link'

import { TeamLogo } from '@/frontend/components/AssetImage'
import { useFavoriteTeams } from '@/frontend/hooks/useFavoriteTeams'

export default function HomePulseFavorites() {
  const { favorites, removeFavorite } = useFavoriteTeams()

  return (
    <section className="hf-stream-favorites" aria-labelledby="stream-favorites-title">
      <header>
        <h2 id="stream-favorites-title">Tus equipos</h2>
      </header>

      {favorites.length ? (
        <div className="hf-stream-favorite-track">
          {favorites.map((team) => (
            <div key={team.id} className="hf-stream-favorite-team">
              <Link href={team.href || `/equipo/${team.id}`}>
                <TeamLogo src={team.logoUrl} team={{ id: team.id }} alt="" size={36} />
                <strong>{team.name}</strong>
              </Link>
              <button
                type="button"
                onClick={() => removeFavorite(team.id)}
                aria-label={`Quitar ${team.name} de favoritos`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="hf-stream-favorite-empty">
          <p>Elegí equipos y encontralos primero en cada jornada.</p>
          <Link href="/equipos">Configurar favoritos</Link>
        </div>
      )}
    </section>
  )
}
