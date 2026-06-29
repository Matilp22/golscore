'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  addFavoriteTeam,
  isFavoriteTeam,
  readFavoriteTeams,
  removeFavoriteTeam,
  subscribeToFavoriteTeams,
  toggleFavoriteTeam,
  type FavoriteTeam,
  type FavoriteTeamInput,
} from '@/frontend/services/favoriteTeamsService'

export function useFavoriteTeams() {
  const [favorites, setFavorites] = useState<FavoriteTeam[]>(() => readFavoriteTeams())

  useEffect(() => {
    return subscribeToFavoriteTeams(setFavorites)
  }, [])

  return useMemo(
    () => ({
      favorites,
      isFavorite: (teamId: string | number) =>
        favorites.some((favorite) => favorite.id === String(teamId)) || isFavoriteTeam(teamId),
      addFavorite: (team: FavoriteTeamInput) => addFavoriteTeam(team),
      removeFavorite: (teamId: string | number) => removeFavoriteTeam(teamId),
      toggleFavorite: (team: FavoriteTeamInput) => toggleFavoriteTeam(team),
    }),
    [favorites]
  )
}
