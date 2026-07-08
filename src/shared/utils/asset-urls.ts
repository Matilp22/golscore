export const API_SPORTS_MEDIA_HOST = 'media.api-sports.io'
export const API_FOOTBALL_MEDIA_HOST = 'media.api-football.com'
export const WIKIMEDIA_UPLOAD_HOST = 'upload.wikimedia.org'
export const YOUTUBE_IMAGE_HOST = 'img.youtube.com'
export const YOUTUBE_IMAGE_ALT_HOST = 'i.ytimg.com'

export const LIGA_PROFESIONAL_ARGENTINA_LOGO_URL =
  '/brand/competitions/leagues/128-liga-profesional-argentina.svg'
export const WORLD_CUP_2026_LOGO_URL =
  '/brand/competitions/world-cup-2026.png'
export const TOURNAMENT_LOGO_URLS: Record<string, string> = {
  'selecciones-mundial': WORLD_CUP_2026_LOGO_URL,
  'argentina-copa-argentina': '/brand/competitions/tournaments/copa-argentina.svg',
  'internacional-libertadores': '/brand/competitions/tournaments/copa-libertadores.svg',
  'internacional-sudamericana': '/brand/competitions/tournaments/copa-sudamericana.svg',
  'conmebol-libertadores': '/brand/competitions/tournaments/copa-libertadores.svg',
  'conmebol-sudamericana': '/brand/competitions/tournaments/copa-sudamericana.svg',
  'selecciones-eliminatorias-conmebol': '/brand/competitions/tournaments/eliminatorias-conmebol.svg',
  'selecciones-eliminatorias-uefa': '/brand/competitions/tournaments/eliminatorias-uefa.svg',
  'selecciones-eliminatorias-concacaf': '/brand/competitions/tournaments/eliminatorias-concacaf.svg',
  'selecciones-eliminatorias-eurocopa': '/brand/competitions/tournaments/eliminatorias-eurocopa.svg',
  'selecciones-repechaje-mundialista': '/brand/competitions/tournaments/repechaje-mundialista.svg',
}

export const TOURNAMENT_LEAGUE_EXTERNAL_IDS: Record<string, number> = {
  'argentina-liga-profesional': 128,
  'argentina-primera-nacional': 129,
  'argentina-copa-argentina': 130,
  'argentina-primera-b-metro': 131,
  'argentina-primera-c': 132,
  'argentina-federal-a': 134,
  'argentina-torneo-proyeccion': 906,
  'internacional-libertadores': 13,
  'internacional-sudamericana': 11,
  'internacional-champions': 2,
  'internacional-europa-league': 3,
  'internacional-conference-league': 848,
  'internacional-concacaf-champions': 16,
  'inglaterra-premier-league': 39,
  'inglaterra-fa-cup': 45,
  'espana-la-liga': 140,
  'espana-copa-del-rey': 143,
  'italia-serie-a': 135,
  'italia-coppa-italia': 137,
  'alemania-bundesliga': 78,
  'alemania-dfb-pokal': 81,
  'portugal-primeira-liga': 94,
  'portugal-taca-de-portugal': 96,
  'francia-ligue-1': 61,
  'francia-copa-francia': 66,
  'brasil-brasileirao': 71,
  'brasil-copa-do-brasil': 73,
  'uruguay-primera-division': 268,
  'uruguay-copa-nacional': 930,
  'paraguay-copa-de-primera': 250,
  'paraguay-copa-paraguay': 252,
  'colombia-liga-betplay': 239,
  'colombia-copa-colombia': 240,
  'chile-primera-division': 265,
  'chile-copa-chile': 267,
  'mexico-liga-mx': 262,
  'mexico-copa-mx': 263,
  'eeuu-mls': 253,
  'eeuu-us-open-cup': 257,
  'selecciones-mundial': 1,
  'selecciones-copa-america': 9,
  'selecciones-eurocopa': 4,
  'selecciones-uefa-nations-league': 5,
  'selecciones-eliminatorias-conmebol': 34,
  'selecciones-eliminatorias-uefa': 32,
  'selecciones-eliminatorias-concacaf': 31,
  'selecciones-eliminatorias-eurocopa': 960,
  'selecciones-repechaje-mundialista': 15,
}

const LEAGUE_LOGO_OVERRIDES: Record<string, string> = {
  '1': WORLD_CUP_2026_LOGO_URL,
  '11': TOURNAMENT_LOGO_URLS['internacional-sudamericana'],
  '13': TOURNAMENT_LOGO_URLS['internacional-libertadores'],
  '15': TOURNAMENT_LOGO_URLS['selecciones-repechaje-mundialista'],
  '31': TOURNAMENT_LOGO_URLS['selecciones-eliminatorias-concacaf'],
  '32': TOURNAMENT_LOGO_URLS['selecciones-eliminatorias-uefa'],
  '34': TOURNAMENT_LOGO_URLS['selecciones-eliminatorias-conmebol'],
  '128': LIGA_PROFESIONAL_ARGENTINA_LOGO_URL,
  '130': TOURNAMENT_LOGO_URLS['argentina-copa-argentina'],
  '960': TOURNAMENT_LOGO_URLS['selecciones-eliminatorias-eurocopa'],
}
const FORCE_LEAGUE_LOGO_OVERRIDES = new Set(['1', '15', '31', '32', '34', '960'])

export const ALLOWED_REMOTE_ASSET_HOSTS = [
  API_SPORTS_MEDIA_HOST,
  API_FOOTBALL_MEDIA_HOST,
  WIKIMEDIA_UPLOAD_HOST,
  YOUTUBE_IMAGE_HOST,
  YOUTUBE_IMAGE_ALT_HOST,
  'gzqapeavjpzgmdhrizqy.supabase.co',
]

function normalizeExternalId(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null

  const normalized = String(value).trim()
  return normalized ? normalized : null
}

export function normalizeAssetUrl(value: string | null | undefined) {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/')) return trimmed

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString()
  } catch {
    return null
  }
}

export function getAssetHostname(value: string | null | undefined) {
  const normalized = normalizeAssetUrl(value)
  if (!normalized) return null
  if (normalized.startsWith('/')) return null

  try {
    return new URL(normalized).hostname
  } catch {
    return null
  }
}

export function isAllowedRemoteAssetHost(value: string | null | undefined) {
  if (value?.trim().startsWith('/')) return true

  const hostname = getAssetHostname(value)
  if (!hostname) return false

  return (
    ALLOWED_REMOTE_ASSET_HOSTS.includes(hostname) ||
    hostname.endsWith('.supabase.co')
  )
}

export function getApiSportsTeamLogoUrl(externalId: string | number | null | undefined) {
  const id = normalizeExternalId(externalId)
  return id ? `https://${API_SPORTS_MEDIA_HOST}/football/teams/${id}.png` : null
}

export function getApiSportsPlayerPhotoUrl(externalId: string | number | null | undefined) {
  const id = normalizeExternalId(externalId)
  return id ? `https://${API_SPORTS_MEDIA_HOST}/football/players/${id}.png` : null
}

export function getApiSportsLeagueLogoUrl(externalId: string | number | null | undefined) {
  const id = normalizeExternalId(externalId)
  return id ? `https://${API_SPORTS_MEDIA_HOST}/football/leagues/${id}.png` : null
}

export function getLeagueLogoOverrideUrl(externalId: string | number | null | undefined) {
  const id = normalizeExternalId(externalId)
  if (!id) return null

  return normalizeAssetUrl(LEAGUE_LOGO_OVERRIDES[id])
}

export function getTournamentLogoOverrideUrl(key: string | null | undefined) {
  if (!key) return null

  return normalizeAssetUrl(TOURNAMENT_LOGO_URLS[key])
}

export function getTournamentExternalLeagueId(key: string | null | undefined) {
  if (!key) return null

  return TOURNAMENT_LEAGUE_EXTERNAL_IDS[key] ?? null
}

export function getTournamentKeyByLeagueExternalId(
  externalId: string | number | null | undefined
) {
  const normalizedId = normalizeExternalId(externalId)
  if (!normalizedId) return null

  return (
    Object.entries(TOURNAMENT_LEAGUE_EXTERNAL_IDS).find(
      ([, id]) => String(id) === normalizedId
    )?.[0] ?? null
  )
}

export function isLegacyApiFootballAssetUrl(value: string | null | undefined) {
  return getAssetHostname(value) === API_FOOTBALL_MEDIA_HOST
}

function pickFreshAssetUrl(
  persistedUrl: string | null | undefined,
  apiUrl: string | null | undefined,
  generatedUrl: string | null | undefined
) {
  const persisted = normalizeAssetUrl(persistedUrl)
  const api = normalizeAssetUrl(apiUrl)
  const generated = normalizeAssetUrl(generatedUrl)

  if (persisted && !isLegacyApiFootballAssetUrl(persisted)) return persisted
  if (api && !isLegacyApiFootballAssetUrl(api)) return api
  if (generated) return generated

  return persisted || api || null
}

export function pickTeamLogoUrl(
  persistedUrl: string | null | undefined,
  externalId: string | number | null | undefined,
  apiUrl?: string | null
) {
  return pickFreshAssetUrl(persistedUrl, apiUrl, getApiSportsTeamLogoUrl(externalId))
}

export function pickLeagueLogoUrl(
  persistedUrl: string | null | undefined,
  externalId: string | number | null | undefined,
  apiUrl?: string | null
) {
  const id = normalizeExternalId(externalId)
  const override = getLeagueLogoOverrideUrl(externalId)

  if (id && FORCE_LEAGUE_LOGO_OVERRIDES.has(id) && override) return override

  return pickFreshAssetUrl(
    persistedUrl,
    apiUrl,
    override || getApiSportsLeagueLogoUrl(externalId)
  )
}

export function pickStableAssetUrl(
  persistedUrl: string | null | undefined,
  apiUrl: string | null | undefined,
  generatedUrl: string | null | undefined
) {
  return normalizeAssetUrl(persistedUrl) || normalizeAssetUrl(apiUrl) || normalizeAssetUrl(generatedUrl)
}
