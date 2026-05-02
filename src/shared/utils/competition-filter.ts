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
      sectionTitle?: string | null
      searchTerms?: string[] | null
    }

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
    input.sectionTitle,
    ...(input.searchTerms ?? []),
  ]

  if (typeof input.league === 'string') {
    parts.push(input.league)
  } else if (input.league) {
    parts.push(input.league.name, input.league.country)
  }

  return parts.filter((part): part is string => Boolean(part))
}

function matchesExcludedCompetitionText(text: string) {
  if (!text) return false

  return (
    /\b(women|woman|female|feminine|feminile|femenino|femenina|femenil|frauen|fem)\b/.test(text) ||
    /\b(u|under|sub)\s*(17|18|19|20|21|23)\b/.test(text) ||
    /\b(youth|juvenil|juveniles)\b/.test(text) ||
    /\b(reserve|reserves|reserva|reservas|proyeccion)\b/.test(text) ||
    /\b(amateur|academy|development)\b/.test(text) ||
    text.includes('promocional amateur')
  )
}

export function isExcludedCompetition(input: CompetitionFilterInput) {
  const text = normalizeCompetitionText(collectCompetitionParts(input).join(' '))

  return matchesExcludedCompetitionText(text)
}
