'use client'

import { useFavoriteTeams } from '@/frontend/hooks/useFavoriteTeams'
import type { FavoriteTeamInput } from '@/frontend/services/favoriteTeamsService'

type FavoriteTeamButtonProps = {
  team: FavoriteTeamInput
  compact?: boolean
  className?: string
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="m12 3.5 2.6 5.25 5.8.85-4.2 4.1 1 5.8-5.2-2.75L6.8 19.5l1-5.8-4.2-4.1 5.8-.85L12 3.5Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export default function FavoriteTeamButton({
  team,
  compact = false,
  className = '',
}: FavoriteTeamButtonProps) {
  const { isFavorite, toggleFavorite } = useFavoriteTeams()
  const active = isFavorite(team.id)

  return (
    <button
      type="button"
      className={`hf-favorite-team-button ${active ? 'is-active' : ''} ${compact ? 'is-compact' : ''} ${className}`}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        toggleFavorite(team)
      }}
      aria-pressed={active}
      aria-label={active ? `Quitar ${team.name} de favoritos` : `Agregar ${team.name} a favoritos`}
      title={active ? 'Siguiendo' : 'Seguir equipo'}
    >
      <StarIcon filled={active} />
      {compact ? null : <span>{active ? 'Siguiendo' : 'Seguir'}</span>}
    </button>
  )
}
