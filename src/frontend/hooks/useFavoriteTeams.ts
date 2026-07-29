'use client'

import { useMemo, useSyncExternalStore } from 'react'
import {
  addFavoriteTeam,
  readFavoriteTeams,
  removeFavoriteTeam,
  subscribeToFavoriteTeams,
  toggleFavoriteTeam,
  type FavoriteTeam,
  type FavoriteTeamInput,
} from '@/frontend/services/favoriteTeamsService'

const EMPTY_FAVORITES: FavoriteTeam[] = []

function subscribe(onStoreChange: () => void) {
  return subscribeToFavoriteTeams(() => onStoreChange())
}

function getServerSnapshot() {
  return EMPTY_FAVORITES
}

export function useFavoriteTeams() {
  const favorites = useSyncExternalStore(
    subscribe,
    readFavoriteTeams,
    getServerSnapshot
  )

  return useMemo(
    () => ({
      favorites,
      isFavorite: (teamId: string | number) =>
        favorites.some((favorite) => favorite.id === String(teamId)),
      addFavorite: (team: FavoriteTeamInput) => addFavoriteTeam(team),
      removeFavorite: (teamId: string | number) => removeFavoriteTeam(teamId),
      toggleFavorite: (team: FavoriteTeamInput) => toggleFavoriteTeam(team),
    }),
    [favorites]
  )
}
