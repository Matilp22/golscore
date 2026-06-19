import 'server-only'

export type FootballPublicReadRoute = 'home' | 'league' | 'match-detail' | 'prode'
export type FootballPublicReadMode = 'legacy' | 'cache-only'

const ROUTE_ENV: Record<FootballPublicReadRoute, string> = {
  home: 'HOME_READ_MODE',
  league: 'LEAGUE_READ_MODE',
  'match-detail': 'MATCH_DETAIL_READ_MODE',
  prode: 'PRODE_READ_MODE',
}

function normalizeReadMode(value: string | undefined): FootballPublicReadMode | null {
  if (value === 'legacy' || value === 'cache-only') return value

  return null
}

export function getFootballPublicReadMode(
  route: FootballPublicReadRoute
): FootballPublicReadMode {
  return (
    normalizeReadMode(process.env[ROUTE_ENV[route]]) ??
    normalizeReadMode(process.env.FOOTBALL_PUBLIC_READ_MODE) ??
    'legacy'
  )
}

export function isFootballPublicCacheOnly(route: FootballPublicReadRoute) {
  return getFootballPublicReadMode(route) === 'cache-only'
}
