export const API_SPORTS_MEDIA_HOST = 'media.api-sports.io'
export const API_FOOTBALL_MEDIA_HOST = 'media.api-football.com'

export const ALLOWED_REMOTE_ASSET_HOSTS = [
  API_SPORTS_MEDIA_HOST,
  API_FOOTBALL_MEDIA_HOST,
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

  try {
    return new URL(normalized).hostname
  } catch {
    return null
  }
}

export function isAllowedRemoteAssetHost(value: string | null | undefined) {
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

export function pickStableAssetUrl(
  persistedUrl: string | null | undefined,
  apiUrl: string | null | undefined,
  generatedUrl: string | null | undefined
) {
  return normalizeAssetUrl(persistedUrl) || normalizeAssetUrl(apiUrl) || normalizeAssetUrl(generatedUrl)
}
