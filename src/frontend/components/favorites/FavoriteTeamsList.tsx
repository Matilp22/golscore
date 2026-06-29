'use client'

import Link from 'next/link'
import { TeamLogo } from '@/frontend/components/AssetImage'
import { useFavoriteTeams } from '@/frontend/hooks/useFavoriteTeams'

type FavoriteTeamsListProps = {
  onOpenSearch?: () => void
  compact?: boolean
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="m12 3.5 2.6 5.25 5.8.85-4.2 4.1 1 5.8-5.2-2.75L6.8 19.5l1-5.8-4.2-4.1 5.8-.85L12 3.5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export default function FavoriteTeamsList({ onOpenSearch, compact = false }: FavoriteTeamsListProps) {
  const { favorites, removeFavorite } = useFavoriteTeams()

  if (!favorites.length) {
    return (
      <div className="hf-favorite-teams-empty">
        <p>Agrega tus equipos favoritos para verlos aca.</p>
        <button type="button" onClick={onOpenSearch}>
          Elegi tu equipo
        </button>
      </div>
    )
  }

  return (
    <div className={compact ? 'hf-favorite-teams-list is-compact' : 'hf-favorite-teams-list'}>
      {favorites.slice(0, compact ? 3 : 6).map((team) => (
        <div key={team.id} className="hf-favorite-team-item">
          <Link href={team.href || `/equipo/${team.id}`}>
            <TeamLogo
              src={team.logoUrl}
              alt={team.name}
              size={28}
              className="h-full w-full object-contain"
            />
            <span>{team.name}</span>
          </Link>
          <button
            type="button"
            className="hf-favorite-team-remove"
            onClick={() => removeFavorite(team.id)}
            aria-label={`Quitar ${team.name} de favoritos`}
            title="Quitar favorito"
          >
            <StarIcon />
          </button>
        </div>
      ))}
      {favorites.length > (compact ? 3 : 6) ? (
        <span className="hf-favorite-teams-more">+{favorites.length - (compact ? 3 : 6)} mas</span>
      ) : null}
    </div>
  )
}
