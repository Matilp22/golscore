'use client'

export const FAVORITE_TEAMS_STORAGE_KEY = 'hf:favorites:teams:v1'
export const FAVORITE_TEAMS_CHANGED_EVENT = 'hf:favorites:teams:changed'

export type FavoriteTeam = {
  id: string
  name: string
  logoUrl?: string | null
  country?: string | null
  href?: string
  createdAt: string
}

export type FavoriteTeamInput = Omit<FavoriteTeam, 'createdAt'> & {
  createdAt?: string
}

const EMPTY_FAVORITES: FavoriteTeam[] = []
let cachedFavoritesRaw: string | null | undefined
let cachedFavorites: FavoriteTeam[] = EMPTY_FAVORITES

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function normalizeTeam(team: FavoriteTeamInput): FavoriteTeam {
  const fallbackId = team.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return {
    id: String(team.id || fallbackId),
    name: team.name,
    logoUrl: team.logoUrl ?? null,
    country: team.country ?? null,
    href: team.href || `/equipo/${team.id || fallbackId}`,
    createdAt: team.createdAt || new Date().toISOString(),
  }
}

function parseFavorites(raw: string | null): FavoriteTeam[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is FavoriteTeamInput => {
        return Boolean(item && typeof item === 'object' && 'id' in item && 'name' in item)
      })
      .map(normalizeTeam)
  } catch {
    return []
  }
}

function notifyFavoriteTeamsChanged(favorites: FavoriteTeam[]) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent(FAVORITE_TEAMS_CHANGED_EVENT, {
      detail: favorites,
    })
  )
}

export function readFavoriteTeams() {
  if (!canUseStorage()) return EMPTY_FAVORITES

  const raw = window.localStorage.getItem(FAVORITE_TEAMS_STORAGE_KEY)
  if (raw === cachedFavoritesRaw) return cachedFavorites

  cachedFavoritesRaw = raw
  cachedFavorites = parseFavorites(raw)

  return cachedFavorites
}

export function writeFavoriteTeams(favorites: FavoriteTeam[]) {
  if (!canUseStorage()) return favorites

  const normalizedFavorites = favorites.map(normalizeTeam)
  const raw = JSON.stringify(normalizedFavorites)
  window.localStorage.setItem(FAVORITE_TEAMS_STORAGE_KEY, raw)
  cachedFavoritesRaw = raw
  cachedFavorites = normalizedFavorites
  notifyFavoriteTeamsChanged(normalizedFavorites)

  return normalizedFavorites
}

export function isFavoriteTeam(teamId: string | number) {
  const id = String(teamId)

  return readFavoriteTeams().some((team) => team.id === id)
}

export function addFavoriteTeam(team: FavoriteTeamInput) {
  const normalizedTeam = normalizeTeam(team)
  const favorites = readFavoriteTeams()

  if (favorites.some((favorite) => favorite.id === normalizedTeam.id)) return favorites

  return writeFavoriteTeams([...favorites, normalizedTeam])
}

export function removeFavoriteTeam(teamId: string | number) {
  const id = String(teamId)

  return writeFavoriteTeams(readFavoriteTeams().filter((team) => team.id !== id))
}

export function toggleFavoriteTeam(team: FavoriteTeamInput) {
  const normalizedTeam = normalizeTeam(team)

  if (isFavoriteTeam(normalizedTeam.id)) {
    return {
      isFavorite: false,
      favorites: removeFavoriteTeam(normalizedTeam.id),
    }
  }

  return {
    isFavorite: true,
    favorites: addFavoriteTeam(normalizedTeam),
  }
}

export function subscribeToFavoriteTeams(callback: (favorites: FavoriteTeam[]) => void) {
  if (typeof window === 'undefined') return () => {}

  const handleLocalChange = (event: Event) => {
    const customEvent = event as CustomEvent<FavoriteTeam[]>
    callback(Array.isArray(customEvent.detail) ? customEvent.detail : readFavoriteTeams())
  }
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key !== FAVORITE_TEAMS_STORAGE_KEY) return

    cachedFavoritesRaw = event.newValue
    cachedFavorites = parseFavorites(event.newValue)
    callback(cachedFavorites)
  }

  window.addEventListener(FAVORITE_TEAMS_CHANGED_EVENT, handleLocalChange)
  window.addEventListener('storage', handleStorageChange)

  return () => {
    window.removeEventListener(FAVORITE_TEAMS_CHANGED_EVENT, handleLocalChange)
    window.removeEventListener('storage', handleStorageChange)
  }
}
