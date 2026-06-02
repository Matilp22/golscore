export const ALLOWED_TOURNAMENTS = [
  {
    slug: 'mundial-2026',
    name: 'Copa del Mundo 2026',
    type: 'cup',
    externalLeagueId: 1,
    season: 2026,
    aliases: [
      'mundial',
      'mundial 2026',
      'world cup 2026',
      'world cup',
      'fifa world cup',
      'copa mundial',
      'copa del mundo',
      'copa del mundo 2026',
    ],
  },
  {
    slug: 'liga-profesional-argentina',
    name: 'Liga Profesional Argentina',
    type: 'league',
    externalLeagueId: 128,
    season: 2026,
    aliases: [
      'liga profesional argentina',
      'liga profesional',
      'primera division',
    ],
  },
  {
    slug: 'primera-b-nacional',
    name: 'Primera B Nacional',
    type: 'league',
    externalLeagueId: 129,
    season: 2026,
    aliases: ['primera b nacional', 'primera nacional', 'nacional b'],
  },
  {
    slug: 'copa-argentina',
    name: 'Copa Argentina',
    type: 'cup',
    externalLeagueId: 130,
    season: 2026,
    aliases: ['copa argentina'],
  },
] as const

export const DEFAULT_PRODE_TOURNAMENT_SLUG = 'mundial-2026'
export type AllowedTournamentSlug = (typeof ALLOWED_TOURNAMENTS)[number]['slug']
export type AllowedTournament = (typeof ALLOWED_TOURNAMENTS)[number]

export function normalizeLeagueName(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function isAllowedProdeLeagueName(value: string | null | undefined) {
  const normalized = normalizeLeagueName(value)

  return ALLOWED_TOURNAMENTS.some((tournament) =>
    [tournament.name, ...tournament.aliases].some(
      (candidate) => normalizeLeagueName(candidate) === normalized
    )
  )
}

export function getAllowedProdeLeagueLabel(value: string | null | undefined) {
  const normalized = normalizeLeagueName(value)
  const tournament = ALLOWED_TOURNAMENTS.find((candidate) =>
    [candidate.name, ...candidate.aliases].some(
      (alias) => normalizeLeagueName(alias) === normalized
    )
  )

  return tournament?.name ?? value ?? 'Torneo'
}

export function getAllowedTournamentBySlug(slug: string | null | undefined) {
  if (!slug) return null

  return ALLOWED_TOURNAMENTS.find((tournament) => tournament.slug === slug) ?? null
}

export function getAllowedTournamentByExternalId(externalId: number | string | null | undefined) {
  if (externalId === null || externalId === undefined) return null

  const normalizedExternalId = Number(externalId)

  if (!Number.isFinite(normalizedExternalId)) return null

  return (
    ALLOWED_TOURNAMENTS.find(
      (tournament) => tournament.externalLeagueId === normalizedExternalId
    ) ?? null
  )
}

export function getAllowedTournamentExternalIds() {
  return ALLOWED_TOURNAMENTS.map((tournament) => tournament.externalLeagueId)
}
