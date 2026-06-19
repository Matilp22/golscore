type CompetitionFilterInput =
  | string
  | null
  | undefined
  | {
      key?: string | null
      title?: string | null
      name?: string | null
      country?: string | null
      league?: string | { name?: string | null; country?: string | null } | null
      leagueName?: string | null
      sectionTitle?: string | null
      searchTerms?: string[] | null
      home?: string | null
      away?: string | null
      homeTeam?: { name?: string | null } | null
      awayTeam?: { name?: string | null } | null
      round?: string | null
      stage?: string | null
      group?: string | null
      leagueId?: number | string | null
      leagueExternalId?: number | string | null
      externalId?: number | string | null
    }

export const ARGENTINA_TORNEO_PROYECCION_KEY = 'argentina-torneo-proyeccion'
export const ARGENTINA_TORNEO_PROYECCION_EXTERNAL_ID = 906

export function normalizeCompetitionText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectCompetitionParts(input: CompetitionFilterInput): string[] {
  if (!input) return []
  if (typeof input === 'string') return [input]

  const parts = [
    input.key,
    input.title,
    input.name,
    input.country,
    input.leagueName,
    input.sectionTitle,
    input.home,
    input.away,
    input.homeTeam?.name,
    input.awayTeam?.name,
    input.round,
    input.stage,
    input.group,
    ...(input.searchTerms ?? []),
  ]

  if (typeof input.league === 'string') {
    parts.push(input.league)
  } else if (input.league) {
    parts.push(input.league.name, input.league.country)
  }

  return parts.filter((part): part is string => Boolean(part))
}

function getCompetitionExternalId(input: CompetitionFilterInput) {
  if (!input || typeof input === 'string') return null

  const value = input.leagueId ?? input.leagueExternalId ?? input.externalId
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function isArgentinaTorneoProyeccion(input: CompetitionFilterInput, text: string) {
  if (getCompetitionExternalId(input) === ARGENTINA_TORNEO_PROYECCION_EXTERNAL_ID) {
    return true
  }

  return (
    text.includes(ARGENTINA_TORNEO_PROYECCION_KEY.replace(/-/g, ' ')) ||
    (text.includes('argentina') && text.includes('torneo proyeccion'))
  )
}

export function getExcludedCompetitionReason(input: CompetitionFilterInput) {
  const text = normalizeCompetitionText(collectCompetitionParts(input).join(' '))

  if (!text) return false

  if (isArgentinaTorneoProyeccion(input, text)) return false

  if (/\b(women|woman|female|feminine|feminile|femenino|femenina|femenil|frauen|fem)\b/.test(text)) {
    return 'women'
  }

  if (/\b(u|under|sub)\s*(17|18|19|20|21|23)\b/.test(text)) {
    return 'youth-age'
  }

  if (/\b(youth|juvenil|juveniles)\b/.test(text)) {
    return 'youth'
  }

  if (/\b(reserve|reserves|reserva|reservas|proyeccion)\b/.test(text)) {
    return 'reserve'
  }

  if (/\b(amateur|academy|development)\b/.test(text) || text.includes('promocional amateur')) {
    return 'non-professional'
  }

  if (
    text.includes('premier league 2') ||
    text.includes('premier league u21') ||
    text.includes('premier league u23') ||
    text.includes('professional development league') ||
    (text.includes('premier league cup') && /\b(u21|u23|development)\b/.test(text))
  ) {
    return 'development-league'
  }

  return false
}

export function isExcludedCompetition(input: CompetitionFilterInput) {
  return Boolean(getExcludedCompetitionReason(input))
}

export function isExcludedMatch(input: CompetitionFilterInput) {
  return isExcludedCompetition(input)
}
