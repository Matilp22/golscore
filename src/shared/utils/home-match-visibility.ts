import {
  ARGENTINA_TORNEO_PROYECCION_EXTERNAL_ID,
  getExcludedCompetitionReason,
} from '@/shared/utils/competition-filter'

export type HomeMatchVisibilityInput = {
  leagueId?: number | null
  league: string
  country?: string | null
  home: string
  away: string
  round?: string | null
}

export type HomeMatchVisibilityResult = {
  included: boolean
  reason:
    | 'allowedLeagueId'
    | 'internationalFriendly'
    | 'featuredClubFriendly'
    | 'argentinaProfessional'
    | 'internationalCompetition'
    | 'englandCompetition'
    | 'spainCompetition'
    | 'italyCompetition'
    | 'germanyCompetition'
    | 'portugalCompetition'
    | 'franceCompetition'
    | 'brazilCompetition'
    | 'uruguayCompetition'
    | 'paraguayCompetition'
    | 'colombiaCompetition'
    | 'chileCompetition'
    | 'mexicoCompetition'
    | 'mlsCompetition'
    | 'nationalTeamCompetition'
    | 'excludedCompetition'
    | 'unsupportedLeague'
  excludedReason: string | false
}

export const HOME_VISIBLE_LEAGUE_IDS = new Set([
  1,
  2,
  3,
  10,
  11,
  13,
  39,
  61,
  71,
  78,
  94,
  128,
  129,
  130,
  135,
  140,
  ARGENTINA_TORNEO_PROYECCION_EXTERNAL_ID,
  848,
])

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function hasTeamName(input: HomeMatchVisibilityInput, expected: string) {
  const expectedValue = normalizeSearchValue(expected)
  const home = normalizeSearchValue(input.home || '')
  const away = normalizeSearchValue(input.away || '')

  return home.includes(expectedValue) || away.includes(expectedValue)
}

export function isFeaturedClubFriendlyMatch(input: HomeMatchVisibilityInput) {
  const league = normalizeSearchValue(input.league || '')
  const round = normalizeSearchValue(input.round || '')
  const isClubFriendly =
    input.leagueId === 667 ||
    league.includes('friendlies clubs') ||
    league.includes('club friendlies') ||
    round.includes('club friendlies')

  if (!isClubFriendly) return false

  return hasTeamName(input, 'zenit') && hasTeamName(input, 'gimnasia l.p.')
}

export function getHomeMatchVisibility(
  input: HomeMatchVisibilityInput
): HomeMatchVisibilityResult {
  const league = normalizeSearchValue(input.league || '')
  const country = normalizeSearchValue(input.country || '')
  const allowedLeagueId = Boolean(
    input.leagueId && HOME_VISIBLE_LEAGUE_IDS.has(input.leagueId)
  )
  const excludedReason = getExcludedCompetitionReason({
    leagueId: input.leagueId,
    league: input.league,
    leagueName: input.league,
    country: input.country,
    home: input.home,
    away: input.away,
    round: input.round,
  })

  if (excludedReason && !allowedLeagueId) {
    return {
      included: false,
      reason: 'excludedCompetition',
      excludedReason,
    }
  }

  if (allowedLeagueId) {
    return {
      included: true,
      reason: 'allowedLeagueId',
      excludedReason: false,
    }
  }

  if (isFeaturedClubFriendlyMatch(input)) {
    return {
      included: true,
      reason: 'featuredClubFriendly',
      excludedReason: false,
    }
  }

  if (country.includes('argentina')) {
    const included =
      league.includes('liga profesional') ||
      league.includes('primera division') ||
      league.includes('primera nacional') ||
      league.includes('copa argentina') ||
      league.includes('copa de la liga') ||
      league.includes('primera b') ||
      league.includes('federal a') ||
      league.includes('primera c')

    return {
      included,
      reason: included ? 'argentinaProfessional' : 'unsupportedLeague',
      excludedReason: false,
    }
  }

  if (
    league.includes('libertadores') ||
    league.includes('sudamericana') ||
    league.includes('champions league') ||
    league.includes('europa league') ||
    league.includes('conference league') ||
    league.includes('intercontinental') ||
    league.includes('concacaf champions')
  ) {
    return {
      included: true,
      reason: 'internationalCompetition',
      excludedReason: false,
    }
  }

  if (country.includes('england')) {
    const included =
      league === 'premier league' ||
      league.includes('fa cup') ||
      league.includes('league cup')

    return {
      included,
      reason: included ? 'englandCompetition' : 'unsupportedLeague',
      excludedReason: false,
    }
  }

  if (country.includes('spain')) {
    const included =
      league === 'la liga' ||
      league.includes('copa del rey') ||
      league.includes('super cup')

    return {
      included,
      reason: included ? 'spainCompetition' : 'unsupportedLeague',
      excludedReason: false,
    }
  }

  if (country.includes('italy')) {
    const included =
      league === 'serie a' ||
      league.includes('coppa italia') ||
      league.includes('super cup')

    return {
      included,
      reason: included ? 'italyCompetition' : 'unsupportedLeague',
      excludedReason: false,
    }
  }

  if (country.includes('germany')) {
    const included = league === 'bundesliga' || league.includes('dfb pokal')

    return {
      included,
      reason: included ? 'germanyCompetition' : 'unsupportedLeague',
      excludedReason: false,
    }
  }

  if (country.includes('portugal')) {
    const included =
      league.includes('primeira liga') ||
      league.includes('taca de portugal') ||
      league.includes('portugal cup')

    return {
      included,
      reason: included ? 'portugalCompetition' : 'unsupportedLeague',
      excludedReason: false,
    }
  }

  if (country.includes('france')) {
    const included = league === 'ligue 1' || league.includes('coupe de france')

    return {
      included,
      reason: included ? 'franceCompetition' : 'unsupportedLeague',
      excludedReason: false,
    }
  }

  if (country.includes('brazil')) {
    const included =
      league === 'serie a' ||
      league.includes('brasileirao') ||
      league.includes('copa do brasil')

    return {
      included,
      reason: included ? 'brazilCompetition' : 'unsupportedLeague',
      excludedReason: false,
    }
  }

  if (country.includes('uruguay')) {
    const included =
      league.includes('primera division') ||
      league.includes('copa uruguay')

    return {
      included,
      reason: included ? 'uruguayCompetition' : 'unsupportedLeague',
      excludedReason: false,
    }
  }

  if (country.includes('paraguay')) {
    const included =
      league.includes('division profesional') ||
      league.includes('copa de primera')

    return {
      included,
      reason: included ? 'paraguayCompetition' : 'unsupportedLeague',
      excludedReason: false,
    }
  }

  if (country.includes('colombia')) {
    const included =
      league.includes('primera a') ||
      league.includes('liga betplay')

    return {
      included,
      reason: included ? 'colombiaCompetition' : 'unsupportedLeague',
      excludedReason: false,
    }
  }

  if (country.includes('chile')) {
    const included =
      league.includes('primera division') ||
      league.includes('copa chile')

    return {
      included,
      reason: included ? 'chileCompetition' : 'unsupportedLeague',
      excludedReason: false,
    }
  }

  if (country.includes('mexico')) {
    const included = league.includes('liga mx')

    return {
      included,
      reason: included ? 'mexicoCompetition' : 'unsupportedLeague',
      excludedReason: false,
    }
  }

  if (league.includes('major league soccer')) {
    return {
      included: true,
      reason: 'mlsCompetition',
      excludedReason: false,
    }
  }

  if (
    league === 'friendlies' ||
    league.includes('international friendlies') ||
    league.includes('friendly international')
  ) {
    return {
      included: true,
      reason: 'internationalFriendly',
      excludedReason: false,
    }
  }

  if (
    league.includes('world cup') ||
    league.includes('copa america') ||
    league.includes('uefa euro') ||
    league.includes('european championship')
  ) {
    return {
      included: true,
      reason: 'nationalTeamCompetition',
      excludedReason: false,
    }
  }

  return {
    included: false,
    reason: 'unsupportedLeague',
    excludedReason: false,
  }
}
