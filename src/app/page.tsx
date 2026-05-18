export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import AutoRefresh from '@/frontend/components/AutoRefresh'
import BrandMark from '@/frontend/components/BrandMark'
import { LeagueLogo } from '@/frontend/components/AssetImage'
import LiveEventToasts from '@/frontend/components/LiveEventToasts'
import MatchRow from '@/frontend/components/MatchRow'
import Link from 'next/link'
import {
  getMatchesByDate,
  type MatchListItemWithGoalScorers,
  withGoalScorers,
} from '@/lib/api-football'
import {
  getSectionConfig,
  getTournamentConfig,
} from '@/lib/tournament-pages'
import { getCompetitionVisibleNameEs } from '@/shared/config/competition-rules'
import {
  addDaysToISO,
  formatMatchTimeArgentina,
  getArgentinaMatchTimestamp,
  getArgentinaTodayISO,
} from '@/shared/utils/argentina-time'
import {
  isLiveStatus,
  isUpcomingStatus,
} from '@/shared/utils/match-status'
import {
  getExcludedCompetitionReason,
  isExcludedCompetition,
} from '@/shared/utils/competition-filter'
import {
  formatHomeMatchStatus,
  formatMatchScoreWithPenalties,
} from '@/shared/utils/match-display'

type ApiMatch = MatchListItemWithGoalScorers

type CompetitionBucket = {
  key: string
  title: string
  logo?: string
  sectionKey: string
  sectionTitle: string
  href?: string | null
  matches: ApiMatch[]
}

type SectionBucket = {
  key: string
  title: string
  competitions: CompetitionBucket[]
}

type LeagueRule = {
  key: string
  sectionKey: string
  sectionTitle: string
  baseTitle: string
  match: (match: ApiMatch) => boolean
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function leagueText(match: ApiMatch) {
  return normalizeText(match.league)
}

function countryText(match: ApiMatch) {
  return normalizeText(match.country || '')
}

function isWomenLeague(match: ApiMatch) {
  const league = leagueText(match)

  return (
    league.includes('women') ||
    league.includes('femenina') ||
    league.includes('feminine') ||
    league.includes('fem.')
  )
}

function isArgentinaReserve(match: ApiMatch) {
  const league = leagueText(match)
  const country = countryText(match)

  return (
    country.includes('argentina') &&
    (
      league.includes('reserva') ||
      league.includes('reserve') ||
      league.includes('proyeccion')
    )
  )
}

function isYouthLeague(match: ApiMatch) {
  if (isArgentinaReserve(match)) return false

  const league = leagueText(match)

  return (
    league.includes('u17') ||
    league.includes('u18') ||
    league.includes('u19') ||
    league.includes('u20') ||
    league.includes('u21') ||
    league.includes('u23') ||
    league.includes('youth') ||
    league.includes('juvenil') ||
    league.includes('sub-') ||
    league.includes('sub ')
  )
}

function isExactLeagueId(match: ApiMatch, leagueId: number) {
  return match.leagueId === leagueId
}

function isExactLeagueName(match: ApiMatch, expectedName: string) {
  return leagueText(match).trim() === expectedName
}

function getHomeExclusionReason(match: ApiMatch) {
  return getExcludedCompetitionReason({
    league: match.league,
    leagueName: match.league,
    country: match.country,
    home: match.home,
    away: match.away,
  })
}

function sortMatches(matches: ApiMatch[]) {
  return [...matches].sort((a, b) => {
    const aLive = !isUpcomingStatus(a.statusShort) ? 0 : 1
    const bLive = !isUpcomingStatus(b.statusShort) ? 0 : 1

    if (aLive !== bLive) return aLive - bLive
    return getArgentinaMatchTimestamp(a.date) - getArgentinaMatchTimestamp(b.date)
  })
}

function slugifyCompetitionKey(value: string) {
  const slug = normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'competencia'
}

function getFallbackSectionForMatch(match: ApiMatch) {
  const country = countryText(match)

  if (country.includes('argentina')) return { key: 'argentina', title: 'Argentina' }
  if (country.includes('england')) return { key: 'inglaterra', title: 'Inglaterra' }
  if (country.includes('spain')) return { key: 'espana', title: 'España' }
  if (country.includes('italy')) return { key: 'italia', title: 'Italia' }
  if (country.includes('germany')) return { key: 'alemania', title: 'Alemania' }
  if (country.includes('portugal')) return { key: 'portugal', title: 'Portugal' }
  if (country.includes('france')) return { key: 'francia', title: 'Francia' }
  if (country.includes('brazil')) return { key: 'brasil', title: 'Brasil' }
  if (country.includes('uruguay')) return { key: 'uruguay', title: 'Uruguay' }
  if (country.includes('paraguay')) return { key: 'paraguay', title: 'Paraguay' }
  if (country.includes('colombia')) return { key: 'colombia', title: 'Colombia' }
  if (country.includes('chile')) return { key: 'chile', title: 'Chile' }
  if (country.includes('mexico')) return { key: 'mexico', title: 'México' }
  if (country.includes('usa') || country.includes('united states')) return { key: 'eeuu', title: 'EEUU' }

  const league = leagueText(match)
  if (
    league.includes('world cup') ||
    league.includes('copa america') ||
    league.includes('uefa euro') ||
    league.includes('nations league') ||
    league.includes('qualification')
  ) {
    return { key: 'selecciones', title: 'Selecciones' }
  }

  if (
    league.includes('libertadores') ||
    league.includes('sudamericana') ||
    league.includes('champions') ||
    league.includes('europa') ||
    league.includes('conference') ||
    league.includes('concacaf')
  ) {
    return { key: 'internacional', title: 'Internacional' }
  }

  return { key: 'resto', title: 'Resto' }
}

function shouldFastRefreshMatch(match: ApiMatch, now: number) {
  if (isLiveStatus(match.statusShort)) return true

  const matchTimestamp = getArgentinaMatchTimestamp(match.date)
  if (!Number.isFinite(matchTimestamp)) return false

  const missingScore = match.goalsHome === null || match.goalsAway === null
  const recentlyStartedOrPlayed =
    matchTimestamp <= now &&
    matchTimestamp >= now - 36 * 60 * 60 * 1000

  if (!isUpcomingStatus(match.statusShort)) {
    return missingScore && recentlyStartedOrPlayed
  }

  const startsSoonOrAlreadyStarted =
    matchTimestamp <= now + 15 * 60 * 1000 &&
    matchTimestamp >= now - 36 * 60 * 60 * 1000

  return startsSoonOrAlreadyStarted
}

function shouldCatchUpStaleRecentMatch(match: ApiMatch, now: number) {
  if (!isUpcomingStatus(match.statusShort)) return false

  const matchTimestamp = getArgentinaMatchTimestamp(match.date)
  if (!Number.isFinite(matchTimestamp)) return false

  return (
    matchTimestamp <= now &&
    matchTimestamp >= now - 36 * 60 * 60 * 1000
  )
}

const SECTION_ORDER = [
  'argentina',
  'internacional',
  'inglaterra',
  'espana',
  'italia',
  'alemania',
  'portugal',
  'francia',
  'brasil',
  'uruguay',
  'paraguay',
  'colombia',
  'chile',
  'mexico',
  'eeuu',
  'selecciones',
  'resto',
]

const SECTION_TITLES: Record<string, string> = {
  argentina: 'Argentina',
  internacional: 'Internacional',
  inglaterra: 'Inglaterra',
  espana: 'España',
  italia: 'Italia',
  alemania: 'Alemania',
  portugal: 'Portugal',
  francia: 'Francia',
  brasil: 'Brasil',
  uruguay: 'Uruguay',
  paraguay: 'Paraguay',
  colombia: 'Colombia',
  chile: 'Chile',
  mexico: 'México',
  eeuu: 'EEUU',
  selecciones: 'Selecciones',
  resto: 'Resto',
}

const HOME_LEAGUE_ID_TO_TOURNAMENT_KEY = new Map<number, string>([
  [128, 'argentina-liga-profesional'],
  [129, 'argentina-primera-nacional'],
  [130, 'argentina-copa-argentina'],
  [131, 'argentina-primera-b-metro'],
  [132, 'argentina-primera-c'],
  [134, 'argentina-federal-a'],
  [13, 'internacional-libertadores'],
  [11, 'internacional-sudamericana'],
  [2, 'internacional-champions'],
  [3, 'internacional-europa-league'],
  [848, 'internacional-conference-league'],
  [16, 'internacional-concacaf-champions'],
  [39, 'inglaterra-premier-league'],
  [45, 'inglaterra-fa-cup'],
  [140, 'espana-la-liga'],
  [143, 'espana-copa-del-rey'],
  [135, 'italia-serie-a'],
  [137, 'italia-coppa-italia'],
  [78, 'alemania-bundesliga'],
  [81, 'alemania-dfb-pokal'],
  [94, 'portugal-primeira-liga'],
  [96, 'portugal-taca-de-portugal'],
  [61, 'francia-ligue-1'],
  [66, 'francia-copa-francia'],
  [71, 'brasil-brasileirao'],
  [73, 'brasil-copa-do-brasil'],
  [253, 'eeuu-mls'],
  [262, 'mexico-liga-mx'],
  [1, 'selecciones-mundial'],
  [9, 'selecciones-copa-america'],
  [4, 'selecciones-eurocopa'],
  [34, 'selecciones-eliminatorias-conmebol'],
  [32, 'selecciones-eliminatorias-uefa'],
  [31, 'selecciones-eliminatorias-concacaf'],
])

const LEAGUE_RULES: LeagueRule[] = [
  {
    key: 'argentina-liga-profesional',
    sectionKey: 'argentina',
    sectionTitle: 'Argentina',
    baseTitle: 'Liga Profesional',
    match: (match) => {
      const league = leagueText(match)
      const country = countryText(match)

      return (
        country.includes('argentina') &&
        (
          league.includes('liga profesional') ||
          league.includes('primera division')
        ) &&
        !league.includes('copa') &&
        !isWomenLeague(match) &&
        !isArgentinaReserve(match)
      )
    },
  },
  {
    key: 'argentina-primera-nacional',
    sectionKey: 'argentina',
    sectionTitle: 'Argentina',
    baseTitle: 'Primera Nacional',
    match: (match) =>
      countryText(match).includes('argentina') &&
      leagueText(match).includes('primera nacional'),
  },
  {
    key: 'argentina-copa-argentina',
    sectionKey: 'argentina',
    sectionTitle: 'Argentina',
    baseTitle: 'Copa Argentina',
    match: (match) => leagueText(match).includes('copa argentina'),
  },
  {
    key: 'argentina-copa-de-la-liga',
    sectionKey: 'argentina',
    sectionTitle: 'Argentina',
    baseTitle: 'Copa de la Liga',
    match: (match) => {
      const league = leagueText(match)
      return (
        countryText(match).includes('argentina') &&
        league.includes('copa de la liga') &&
        !league.includes('reserve') &&
        !league.includes('reserva')
      )
    },
  },
  {
    key: 'argentina-primera-b-metro',
    sectionKey: 'argentina',
    sectionTitle: 'Argentina',
    baseTitle: 'Primera B Metro',
    match: (match) => {
      const league = leagueText(match)
      return (
        countryText(match).includes('argentina') &&
        (
          league === 'primera b' ||
          league.includes('primera b metropolitana') ||
          league.includes('primera b metro') ||
          (league.includes('primera b') && league.includes('metropolitana'))
        )
      )
    },
  },
  {
    key: 'argentina-federal-a',
    sectionKey: 'argentina',
    sectionTitle: 'Argentina',
    baseTitle: 'Federal A',
    match: (match) =>
      countryText(match).includes('argentina') &&
      leagueText(match).includes('federal a'),
  },
  {
    key: 'argentina-primera-c',
    sectionKey: 'argentina',
    sectionTitle: 'Argentina',
    baseTitle: 'Primera C',
    match: (match) =>
      countryText(match).includes('argentina') &&
      leagueText(match).includes('primera c'),
  },
  {
    key: 'argentina-promocional-amateur',
    sectionKey: 'argentina',
    sectionTitle: 'Argentina',
    baseTitle: 'Promocional Amateur',
    match: (match) => {
      const league = leagueText(match)
      return (
        countryText(match).includes('argentina') &&
        (
          league.includes('promocional amateur') ||
          league.includes('primera d')
        )
      )
    },
  },
  {
    key: 'argentina-reserva',
    sectionKey: 'argentina',
    sectionTitle: 'Argentina',
    baseTitle: 'Liga Profesional - Reserva',
    match: (match) => isArgentinaReserve(match),
  },
  {
    key: 'argentina-liga-femenina',
    sectionKey: 'argentina',
    sectionTitle: 'Argentina',
    baseTitle: 'Liga Femenina',
    match: (match) => {
      const league = leagueText(match)
      return (
        countryText(match).includes('argentina') &&
        isWomenLeague(match) &&
        (
          league.includes('liga profesional') ||
          league.includes('primera division') ||
          league.includes('liga femenina')
        )
      )
    },
  },
  {
    key: 'argentina-copa-de-la-liga-reserva',
    sectionKey: 'argentina',
    sectionTitle: 'Argentina',
    baseTitle: 'Copa de la Liga - Reserva',
    match: (match) => {
      const league = leagueText(match)
      return (
        countryText(match).includes('argentina') &&
        league.includes('copa de la liga') &&
        (league.includes('reserve') || league.includes('reserva'))
      )
    },
  },
  {
    key: 'internacional-libertadores',
    sectionKey: 'internacional',
    sectionTitle: 'Internacional',
    baseTitle: 'Copa Libertadores',
    match: (match) => leagueText(match).includes('libertadores'),
  },
  {
    key: 'internacional-sudamericana',
    sectionKey: 'internacional',
    sectionTitle: 'Internacional',
    baseTitle: 'Copa Sudamericana',
    match: (match) => leagueText(match).includes('sudamericana'),
  },
  {
    key: 'internacional-champions',
    sectionKey: 'internacional',
    sectionTitle: 'Internacional',
    baseTitle: 'Champions League',
    match: (match) => {
      const league = leagueText(match)
      return (
        league.includes('champions league') &&
        !league.includes('caf') &&
        !league.includes('concacaf') &&
        !league.includes('afc')
      )
    },
  },
  {
    key: 'internacional-copa-intercontinental',
    sectionKey: 'internacional',
    sectionTitle: 'Internacional',
    baseTitle: 'Copa Intercontinental',
    match: (match) => leagueText(match).includes('intercontinental'),
  },
  {
    key: 'internacional-europa-league',
    sectionKey: 'internacional',
    sectionTitle: 'Internacional',
    baseTitle: 'Europa League',
    match: (match) => {
      const league = leagueText(match)
      return league.includes('europa league') && !league.includes('conference')
    },
  },
  {
    key: 'internacional-conference-league',
    sectionKey: 'internacional',
    sectionTitle: 'Internacional',
    baseTitle: 'Conference League',
    match: (match) => leagueText(match).includes('conference league'),
  },
  {
    key: 'internacional-mundial-de-clubes',
    sectionKey: 'internacional',
    sectionTitle: 'Internacional',
    baseTitle: 'Mundial de Clubes',
    match: (match) => {
      const league = leagueText(match)
      return league.includes('club world cup') || league.includes('world cup clubs')
    },
  },
  {
    key: 'internacional-concacaf-champions',
    sectionKey: 'internacional',
    sectionTitle: 'Internacional',
    baseTitle: 'Concacaf Champions',
    match: (match) => {
      const league = leagueText(match)
      return (
        league.includes('concacaf champions') ||
        league.includes('concacaf champions cup') ||
        league.includes('copa de campeones concacaf')
      )
    },
  },
  {
    key: 'inglaterra-premier-league',
    sectionKey: 'inglaterra',
    sectionTitle: 'Inglaterra',
    baseTitle: 'Premier League',
    match: (match) =>
      countryText(match).includes('england') &&
      (
        isExactLeagueId(match, 39) ||
        isExactLeagueName(match, 'premier league')
      ) &&
      !isWomenLeague(match),
  },
  {
    key: 'inglaterra-carabao-cup',
    sectionKey: 'inglaterra',
    sectionTitle: 'Inglaterra',
    baseTitle: 'Carabao Cup',
    match: (match) => {
      const league = leagueText(match)
      return (
        countryText(match).includes('england') &&
        (league.includes('carabao') || league.includes('league cup'))
      )
    },
  },
  {
    key: 'inglaterra-fa-cup',
    sectionKey: 'inglaterra',
    sectionTitle: 'Inglaterra',
    baseTitle: 'FA Cup',
    match: (match) =>
      countryText(match).includes('england') &&
      leagueText(match).includes('fa cup'),
  },
  {
    key: 'espana-la-liga',
    sectionKey: 'espana',
    sectionTitle: 'España',
    baseTitle: 'La Liga',
    match: (match) =>
      countryText(match).includes('spain') &&
      (
        isExactLeagueId(match, 140) ||
        isExactLeagueName(match, 'la liga')
      ) &&
      !isWomenLeague(match),
  },
  {
    key: 'espana-copa-del-rey',
    sectionKey: 'espana',
    sectionTitle: 'España',
    baseTitle: 'Copa del Rey',
    match: (match) =>
      countryText(match).includes('spain') &&
      leagueText(match).includes('copa del rey'),
  },
  {
    key: 'espana-supercopa',
    sectionKey: 'espana',
    sectionTitle: 'España',
    baseTitle: 'Supercopa',
    match: (match) =>
      countryText(match).includes('spain') &&
      leagueText(match).includes('super cup'),
  },
  {
    key: 'italia-serie-a',
    sectionKey: 'italia',
    sectionTitle: 'Italia',
    baseTitle: 'Serie A',
    match: (match) =>
      countryText(match).includes('italy') &&
      (
        isExactLeagueId(match, 135) ||
        isExactLeagueName(match, 'serie a')
      ) &&
      !isWomenLeague(match),
  },
  {
    key: 'italia-coppa-italia',
    sectionKey: 'italia',
    sectionTitle: 'Italia',
    baseTitle: 'Coppa Italia',
    match: (match) =>
      countryText(match).includes('italy') &&
      leagueText(match).includes('coppa italia'),
  },
  {
    key: 'italia-supercopa',
    sectionKey: 'italia',
    sectionTitle: 'Italia',
    baseTitle: 'Supercopa',
    match: (match) =>
      countryText(match).includes('italy') &&
      leagueText(match).includes('super cup'),
  },
  {
    key: 'alemania-bundesliga',
    sectionKey: 'alemania',
    sectionTitle: 'Alemania',
    baseTitle: 'Bundesliga',
    match: (match) =>
      countryText(match).includes('germany') &&
      (
        isExactLeagueId(match, 78) ||
        isExactLeagueName(match, 'bundesliga')
      ) &&
      !isWomenLeague(match),
  },
  {
    key: 'alemania-dfb-pokal',
    sectionKey: 'alemania',
    sectionTitle: 'Alemania',
    baseTitle: 'DFB Pokal',
    match: (match) =>
      countryText(match).includes('germany') &&
      leagueText(match).includes('dfb pokal'),
  },
  {
    key: 'portugal-primeira-liga',
    sectionKey: 'portugal',
    sectionTitle: 'Portugal',
    baseTitle: 'Primeira Liga',
    match: (match) =>
      countryText(match).includes('portugal') &&
      leagueText(match).includes('primeira liga') &&
      !isWomenLeague(match),
  },
  {
    key: 'portugal-taca-de-portugal',
    sectionKey: 'portugal',
    sectionTitle: 'Portugal',
    baseTitle: 'Taça de Portugal',
    match: (match) => {
      const league = leagueText(match)
      return (
        countryText(match).includes('portugal') &&
        (
          league.includes('taca de portugal') ||
          league.includes('taça de portugal') ||
          league.includes('portugal cup')
        )
      )
    },
  },
  {
    key: 'francia-ligue-1',
    sectionKey: 'francia',
    sectionTitle: 'Francia',
    baseTitle: 'Ligue 1',
    match: (match) =>
      countryText(match).includes('france') &&
      (
        isExactLeagueId(match, 61) ||
        isExactLeagueName(match, 'ligue 1')
      ) &&
      !isWomenLeague(match),
  },
  {
    key: 'francia-copa-francia',
    sectionKey: 'francia',
    sectionTitle: 'Francia',
    baseTitle: 'Copa Francia',
    match: (match) =>
      countryText(match).includes('france') &&
      leagueText(match).includes('coupe de france'),
  },
  {
    key: 'brasil-brasileirao',
    sectionKey: 'brasil',
    sectionTitle: 'Brasil',
    baseTitle: 'Brasileirão',
    match: (match) =>
      countryText(match).includes('brazil') &&
      leagueText(match).includes('serie a') &&
      !isWomenLeague(match),
  },
  {
    key: 'brasil-copa-do-brasil',
    sectionKey: 'brasil',
    sectionTitle: 'Brasil',
    baseTitle: 'Copa do Brasil',
    match: (match) =>
      countryText(match).includes('brazil') &&
      leagueText(match).includes('copa do brasil'),
  },
  {
    key: 'uruguay-primera-division',
    sectionKey: 'uruguay',
    sectionTitle: 'Uruguay',
    baseTitle: 'Primera División',
    match: (match) =>
      countryText(match).includes('uruguay') &&
      leagueText(match).includes('primera division'),
  },
  {
    key: 'uruguay-copa-nacional',
    sectionKey: 'uruguay',
    sectionTitle: 'Uruguay',
    baseTitle: 'Copa Nacional',
    match: (match) => {
      const league = leagueText(match)
      return (
        countryText(match).includes('uruguay') &&
        (
          league.includes('copa uruguay') ||
          league.includes('auf uruguay cup') ||
          league.includes('copa nacional')
        )
      )
    },
  },
  {
    key: 'paraguay-copa-de-primera',
    sectionKey: 'paraguay',
    sectionTitle: 'Paraguay',
    baseTitle: 'Copa de Primera',
    match: (match) => {
      const league = leagueText(match)
      return (
        countryText(match).includes('paraguay') &&
        (league.includes('division profesional') || league.includes('copa de primera'))
      )
    },
  },
  {
    key: 'paraguay-copa-paraguay',
    sectionKey: 'paraguay',
    sectionTitle: 'Paraguay',
    baseTitle: 'Copa Paraguay',
    match: (match) =>
      countryText(match).includes('paraguay') &&
      leagueText(match).includes('copa paraguay'),
  },
  {
    key: 'colombia-liga-betplay',
    sectionKey: 'colombia',
    sectionTitle: 'Colombia',
    baseTitle: 'Liga BetPlay',
    match: (match) => {
      const league = leagueText(match)
      return (
        countryText(match).includes('colombia') &&
        (league.includes('primera a') || league.includes('liga betplay'))
      )
    },
  },
  {
    key: 'colombia-copa-colombia',
    sectionKey: 'colombia',
    sectionTitle: 'Colombia',
    baseTitle: 'Copa Colombia',
    match: (match) =>
      countryText(match).includes('colombia') &&
      leagueText(match).includes('copa colombia'),
  },
  {
    key: 'chile-primera-division',
    sectionKey: 'chile',
    sectionTitle: 'Chile',
    baseTitle: 'Primera División',
    match: (match) =>
      countryText(match).includes('chile') &&
      leagueText(match).includes('primera division'),
  },
  {
    key: 'chile-copa-chile',
    sectionKey: 'chile',
    sectionTitle: 'Chile',
    baseTitle: 'Copa Chile',
    match: (match) =>
      countryText(match).includes('chile') &&
      leagueText(match).includes('copa chile'),
  },
  {
    key: 'mexico-liga-mx',
    sectionKey: 'mexico',
    sectionTitle: 'México',
    baseTitle: 'Liga MX',
    match: (match) =>
      countryText(match).includes('mexico') &&
      leagueText(match).includes('liga mx'),
  },
  {
    key: 'mexico-copa-mx',
    sectionKey: 'mexico',
    sectionTitle: 'México',
    baseTitle: 'Copa MX',
    match: (match) =>
      countryText(match).includes('mexico') &&
      leagueText(match).includes('copa mx'),
  },
  {
    key: 'eeuu-mls',
    sectionKey: 'eeuu',
    sectionTitle: 'EEUU',
    baseTitle: 'MLS',
    match: (match) => leagueText(match).includes('major league soccer'),
  },
  {
    key: 'eeuu-us-open-cup',
    sectionKey: 'eeuu',
    sectionTitle: 'EEUU',
    baseTitle: 'US Open Cup',
    match: (match) => {
      const league = leagueText(match)
      return (
        league.includes('us open cup') ||
        league.includes('u.s. open cup')
      )
    },
  },
  {
    key: 'selecciones-mundial-sub20',
    sectionKey: 'selecciones',
    sectionTitle: 'Selecciones',
    baseTitle: 'Mundial Sub-20',
    match: (match) =>
      leagueText(match).includes('world cup') &&
      leagueText(match).includes('u20'),
  },
  {
    key: 'selecciones-copa-america',
    sectionKey: 'selecciones',
    sectionTitle: 'Selecciones',
    baseTitle: 'Copa América',
    match: (match) => leagueText(match).includes('copa america'),
  },
  {
    key: 'selecciones-eliminatorias-conmebol',
    sectionKey: 'selecciones',
    sectionTitle: 'Selecciones',
    baseTitle: 'Eliminatorias Conmebol',
    match: (match) => {
      const league = leagueText(match)
      return (
        league.includes('world cup - qualification south america') ||
        league.includes('fifa world cup qualification - south america') ||
        league.includes('eliminatorias sudamericanas')
      )
    },
  },
  {
    key: 'selecciones-eliminatorias-uefa',
    sectionKey: 'selecciones',
    sectionTitle: 'Selecciones',
    baseTitle: 'Eliminatorias UEFA',
    match: (match) => {
      const league = leagueText(match)
      return (
        league.includes('world cup - qualification europe') ||
        league.includes('fifa world cup qualification - europe')
      )
    },
  },
  {
    key: 'selecciones-eurocopa',
    sectionKey: 'selecciones',
    sectionTitle: 'Selecciones',
    baseTitle: 'Eurocopa',
    match: (match) => {
      const league = leagueText(match)
      return league.includes('uefa euro') || league.includes('european championship')
    },
  },
  {
    key: 'selecciones-uefa-nations-league',
    sectionKey: 'selecciones',
    sectionTitle: 'Selecciones',
    baseTitle: 'UEFA Nations League',
    match: (match) => leagueText(match).includes('uefa nations league'),
  },
  {
    key: 'selecciones-eliminatorias-eurocopa',
    sectionKey: 'selecciones',
    sectionTitle: 'Selecciones',
    baseTitle: 'Eliminatorias Eurocopa',
    match: (match) => leagueText(match).includes('uefa euro qualification'),
  },
  {
    key: 'selecciones-mundial',
    sectionKey: 'selecciones',
    sectionTitle: 'Selecciones',
    baseTitle: 'Mundial',
    match: (match) => {
      const league = leagueText(match)
      return (
        league.includes('world cup') &&
        !league.includes('club') &&
        !league.includes('qualification') &&
        !league.includes('u20')
      )
    },
  },
  {
    key: 'selecciones-sudamericano-sub20',
    sectionKey: 'selecciones',
    sectionTitle: 'Selecciones',
    baseTitle: 'Sudamericano Sub-20',
    match: (match) =>
      leagueText(match).includes('sudamericano') &&
      leagueText(match).includes('u20'),
  },
  {
    key: 'selecciones-eliminatorias-concacaf',
    sectionKey: 'selecciones',
    sectionTitle: 'Selecciones',
    baseTitle: 'Eliminatorias Concacaf',
    match: (match) => {
      const league = leagueText(match)
      return (
        league.includes('world cup - qualification concacaf') ||
        league.includes('fifa world cup qualification - concacaf')
      )
    },
  },
  {
    key: 'selecciones-repechaje-mundialista',
    sectionKey: 'selecciones',
    sectionTitle: 'Selecciones',
    baseTitle: 'Repechaje Mundialista',
    match: (match) =>
      leagueText(match).includes('world cup - qualification intercontinental play-offs'),
  },
]

function sortCompetitionsForSection(
  sectionKey: string,
  competitions: CompetitionBucket[]
) {
  const overrideItems = getSectionConfig(sectionKey)?.tournaments

  if (!overrideItems) return competitions

  const order = new Map(
    overrideItems.map((item, index) => [item.key, index])
  )

  return [...competitions].sort((a, b) => {
    const aIndex = order.get(a.key) ?? Number.MAX_SAFE_INTEGER
    const bIndex = order.get(b.key) ?? Number.MAX_SAFE_INTEGER

    if (aIndex !== bIndex) return aIndex - bIndex
    return a.title.localeCompare(b.title)
  })
}

function getHomeCompetitionPriority(competition: CompetitionBucket) {
  const text = normalizeText(
    `${competition.key} ${competition.title} ${competition.sectionTitle}`
  )
  const isMainArgentinaLeague =
    !text.includes('reserva') &&
    !text.includes('femenina') &&
    !text.includes('women')

  if (
    competition.key === 'argentina-liga-profesional' ||
    (
      isMainArgentinaLeague &&
      (
        text.includes('liga argentina') ||
        text.includes('liga profesional argentina') ||
        text.includes('argentina liga profesional') ||
        text.includes('liga profesional')
      )
    )
  ) {
    return 1
  }

  if (
    competition.key === 'selecciones-mundial' ||
    text.includes('mundial 2026') ||
    text === 'mundial' ||
    text.includes(' world cup ')
  ) {
    return 2
  }

  if (
    competition.key === 'internacional-libertadores' ||
    text.includes('copa libertadores') ||
    text.includes('conmebol libertadores') ||
    text.includes('libertadores')
  ) {
    return 3
  }

  if (
    competition.key === 'internacional-sudamericana' ||
    text.includes('copa sudamericana') ||
    text.includes('conmebol sudamericana') ||
    text.includes('sudamericana')
  ) {
    return 4
  }

  if (
    competition.key === 'internacional-champions' ||
    text.includes('uefa champions league') ||
    text.includes('champions league')
  ) {
    return 5
  }

  if (
    competition.key === 'argentina-primera-nacional' ||
    text.includes('primera nacional')
  ) {
    return 6
  }

  if (
    competition.key === 'argentina-primera-b-metro' ||
    text.includes('primera b metro') ||
    text.includes('primera b metropolitana')
  ) {
    return 7
  }

  return Number.MAX_SAFE_INTEGER
}

function sortHomeCompetitions(competitions: CompetitionBucket[]) {
  return competitions
    .map((competition, index) => ({ competition, index }))
    .sort((a, b) => {
      const aPriority = getHomeCompetitionPriority(a.competition)
      const bPriority = getHomeCompetitionPriority(b.competition)

      if (aPriority !== bPriority) return aPriority - bPriority
      return a.index - b.index
    })
    .map(({ competition }) => competition)
}

function resolveHomeCompetitionHref(ruleKey: string, sampleMatch?: ApiMatch) {
  const tournamentKey =
    getTournamentConfig(ruleKey)?.key ??
    (sampleMatch?.leagueId
      ? HOME_LEAGUE_ID_TO_TOURNAMENT_KEY.get(sampleMatch.leagueId)
      : null)
  const tournament = tournamentKey ? getTournamentConfig(tournamentKey) : null

  if (tournament) return `/liga/${tournament.key}`

  console.warn('[home] no se pudo resolver link de liga', {
    ruleKey,
    leagueId: sampleMatch?.leagueId ?? null,
    league: sampleMatch?.league ?? null,
  })

  return null
}

function resolveFallbackHomeCompetitionHref(sampleMatch?: ApiMatch) {
  const tournamentKey =
    sampleMatch?.leagueId && Number.isFinite(sampleMatch.leagueId)
      ? HOME_LEAGUE_ID_TO_TOURNAMENT_KEY.get(sampleMatch.leagueId)
      : null
  const tournament = tournamentKey ? getTournamentConfig(tournamentKey) : null

  return tournament ? `/liga/${tournament.key}` : null
}

function resolveHomeCompetitionLogo(sampleMatch?: ApiMatch) {
  if (sampleMatch?.leagueLogo) return sampleMatch.leagueLogo

  if (sampleMatch?.leagueId && Number.isFinite(sampleMatch.leagueId)) {
    return `https://media.api-sports.io/football/leagues/${sampleMatch.leagueId}.png`
  }

  return undefined
}

function groupMatchesWithPromiedosStructure(matches: ApiMatch[]): SectionBucket[] {
  const cleanMatches = matches.filter((match) => {
    const reason =
      (isYouthLeague(match) ? 'legacy-youth-filter' : false) ||
      getHomeExclusionReason(match)
    const excluded = Boolean(reason)

    if (excluded && process.env.NODE_ENV === 'development') {
      console.info('[home-filter] excluded match', {
        league: match.league,
        leagueId: match.leagueId ?? null,
        home: match.home,
        away: match.away,
        reason,
      })
    }

    return !excluded
  })
  const assignedMatchIds = new Set<number>()
  const competitionBuckets: CompetitionBucket[] = []

  for (const rule of LEAGUE_RULES) {
    if (
      isExcludedCompetition({
        key: rule.key,
        title: rule.baseTitle,
        sectionTitle: rule.sectionTitle,
      })
    ) {
      continue
    }

    const filtered = cleanMatches.filter((match) => {
      if (assignedMatchIds.has(match.id)) return false
      return rule.match(match)
    })

    if (filtered.length === 0) continue

    competitionBuckets.push({
      key: rule.key,
      title: getCompetitionVisibleNameEs(rule.key, rule.baseTitle),
      logo: resolveHomeCompetitionLogo(filtered[0]),
      sectionKey: rule.sectionKey,
      sectionTitle: rule.sectionTitle,
      href: resolveHomeCompetitionHref(rule.key, filtered[0]),
      matches: sortMatches(filtered),
    })

    filtered.forEach((match) => assignedMatchIds.add(match.id))
  }

  const fallbackBuckets = new Map<string, CompetitionBucket>()

  for (const match of cleanMatches) {
    if (assignedMatchIds.has(match.id)) continue

    const fallbackSection = getFallbackSectionForMatch(match)
    const leagueKey =
      match.leagueId && Number.isFinite(match.leagueId)
        ? `league-${match.leagueId}`
        : slugifyCompetitionKey(`${match.country || 'internacional'}-${match.league || 'otros'}`)
    const bucketKey = `fallback-${leagueKey}`
    const existingBucket = fallbackBuckets.get(bucketKey)

    if (existingBucket) {
      existingBucket.matches.push(match)
      continue
    }

    fallbackBuckets.set(bucketKey, {
      key: bucketKey,
      title: getCompetitionVisibleNameEs(bucketKey, match.league || 'Otros partidos'),
      logo: resolveHomeCompetitionLogo(match),
      sectionKey: fallbackSection.key,
      sectionTitle: fallbackSection.title,
      href: resolveFallbackHomeCompetitionHref(match),
      matches: [match],
    })
  }

  for (const bucket of fallbackBuckets.values()) {
    bucket.matches = sortMatches(bucket.matches)
    competitionBuckets.push(bucket)
  }

  return SECTION_ORDER.map((sectionKey) => ({
    key: sectionKey,
    title:
      competitionBuckets.find((competition) => competition.sectionKey === sectionKey)?.sectionTitle ||
      SECTION_TITLES[sectionKey] ||
      sectionKey,
    competitions: sortCompetitionsForSection(
      sectionKey,
      competitionBuckets.filter(
        (competition) => competition.sectionKey === sectionKey
      )
    ),
  }))
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const sp = await searchParams

  const todayISO = getArgentinaTodayISO()
  const yesterdayISO = addDaysToISO(todayISO, -1)
  const tomorrowISO = addDaysToISO(todayISO, 1)

  const selectedDate = sp.date || todayISO

  const dayOptions = [
    { label: 'Ayer', value: yesterdayISO },
    { label: 'Hoy', value: todayISO },
    { label: 'Mañana', value: tomorrowISO },
  ]

  let groupedSections: SectionBucket[] = SECTION_ORDER.map((sectionKey) => ({
    key: sectionKey,
    title: SECTION_TITLES[sectionKey],
    competitions: [],
  }))
  let dateMatches: ApiMatch[] = []

  let dataError: string | null = null

  try {
    const enrichedMatches = await withGoalScorers(await getMatchesByDate(selectedDate))
    dateMatches = enrichedMatches

    if (process.env.NODE_ENV === 'development') {
      const missingMatches = enrichedMatches.filter((match) => !match.persistedInSupabase)

      if (missingMatches.length) {
        console.info('[home] partidos servidos desde cache sin extras de Supabase', {
          selectedDate,
          fallback: missingMatches.length,
          sample: missingMatches.slice(0, 20).map((match) => ({
            externalId: match.externalId ?? match.id,
            league: match.league,
            home: match.home,
            away: match.away,
          })),
        })
      }
    }

    groupedSections = groupMatchesWithPromiedosStructure(dateMatches)
  } catch {
    dataError = 'Datos temporalmente no disponibles. Intentá nuevamente en unos minutos.'
  }

  const visibleSections = groupedSections.filter(
    (section) => section.competitions.length > 0
  )
  const visibleCompetitions = sortHomeCompetitions(
    visibleSections.flatMap((section) => section.competitions)
  )
  const renderedAt = new Date().toISOString()
  const now = Date.parse(renderedAt)
  const hasFastRefreshMatches = dateMatches.some((match) =>
    shouldFastRefreshMatch(match, now)
  )
  const hasStaleRecentMatches = dateMatches.some((match) =>
    shouldCatchUpStaleRecentMatch(match, now)
  )
  const hasLiveMatches = dateMatches.some((match) => isLiveStatus(match.statusShort))
  const liveEvents = visibleCompetitions.flatMap((competition) =>
    competition.matches.flatMap((match) => match.liveEvents || [])
  )
  const visibleFixtureIds = visibleCompetitions.flatMap((competition) =>
    competition.matches.map((match) => match.externalId ?? match.id)
  )
  const refreshIntervalMs = hasFastRefreshMatches ? 60000 : 300000

  return (
    <div className="min-h-screen overflow-x-hidden bg-transparent text-white">
      <div className="w-full px-0 py-1 lg:mx-auto lg:max-w-7xl lg:px-5 lg:py-4">
        <header className="hf-hero relative mb-4 w-full overflow-hidden rounded-3xl px-3 py-4 sm:px-4 md:px-5 md:py-5">
          <div className="relative z-10 mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1>
                <BrandMark hero />
              </h1>
              <p className="mt-3 max-w-2xl text-xs font-semibold uppercase tracking-[0.22em] text-[#70ff9d] md:text-sm">
                Partidos del dia, marcadores en vivo y agenda fulbo total
              </p>
            </div>

            <AutoRefresh
              intervalMs={refreshIntervalMs}
              showButton
              initialUpdatedAt={renderedAt}
              syncBeforeRefreshUrl={
                hasFastRefreshMatches
                  ? `/api/home/live-sync?date=${encodeURIComponent(selectedDate)}${
                      hasStaleRecentMatches ? '&catchup=1' : ''
                    }`
                  : null
              }
            />
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-center">
            {dayOptions.map((day) => (
              <a
                key={day.value}
                href={`/?date=${day.value}`}
                className={`flex min-h-11 items-center justify-center rounded-xl border px-2 py-2 text-center text-sm font-black transition sm:px-4 ${
                  selectedDate === day.value
                    ? 'border-[#70ff9d]/35 bg-[rgba(112,255,157,0.16)] text-[#dfffe9] shadow-[0_0_26px_rgba(112,255,157,0.12)]'
                    : 'border-white/10 bg-black/20 text-[#c7d0da] hover:border-[#70ff9d]/30 hover:bg-[#70ff9d]/10 hover:text-white'
                }`}
              >
                {day.label}
              </a>
            ))}
          </div>
        </header>

          <main className="min-w-0 space-y-2">
            {dataError ? (
              <div className="rounded-2xl border border-[#5a2a2a] bg-[#3b1919] p-6">
                <p className="text-sm font-medium text-[#ffd5d5]">
                  {dataError}
                </p>
              </div>
            ) : null}

            {visibleCompetitions.length ? (
              <section className="w-full min-w-0 space-y-2">
                <div className="space-y-2">
                  {visibleCompetitions.map((competition) => (
                    <div
                      id={competition.key}
                      key={competition.key}
                      className="hf-card hf-card-hover scroll-mt-4 overflow-hidden rounded-2xl"
                    >
                      <div className="hf-section-head px-2.5 py-1.5 sm:px-3">
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          {competition.href ? (
                            <Link
                              href={competition.href}
                              className="inline-flex min-w-0 items-center gap-2 text-sm font-black text-[#f3f6fa] no-underline transition hover:text-[#7ff0b2] hover:no-underline md:text-base"
                            >
                              {competition.logo ? (
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                                  <LeagueLogo
                                    src={competition.logo}
                                    alt={competition.title}
                                    size={20}
                                    className="h-5 w-5 object-contain"
                                    fallbackClassName="h-4 w-3"
                                  />
                                </span>
                              ) : null}
                              <span className="break-words">{competition.title}</span>
                            </Link>
                          ) : (
                            <h2 className="inline-flex min-w-0 items-center gap-2 text-sm font-black text-[#f3f6fa] md:text-base">
                              {competition.logo ? (
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                                  <LeagueLogo
                                    src={competition.logo}
                                    alt={competition.title}
                                    size={20}
                                    className="h-5 w-5 object-contain"
                                    fallbackClassName="h-4 w-3"
                                  />
                                </span>
                              ) : null}
                              <span className="break-words">{competition.title}</span>
                            </h2>
                          )}

                          <div className="hf-badge shrink-0 rounded-lg px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.06em]">
                            {competition.matches.length} partido{competition.matches.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      <div>
                        {competition.matches.map((match) => (
                          <MatchRow
                            key={match.id}
                            id={match.id}
                            league={competition.title}
                            country={match.country}
                            homeLogo={match.homeLogo}
                            awayLogo={match.awayLogo}
                            time={formatMatchTimeArgentina(match.date)}
                            home={match.home}
                            away={match.away}
                            score={formatMatchScoreWithPenalties({
                              goalsHome: match.goalsHome,
                              goalsAway: match.goalsAway,
                              homePenaltyScore: match.homePenaltyScore,
                              awayPenaltyScore: match.awayPenaltyScore,
                            })}
                            status={formatHomeMatchStatus({
                              statusShort: match.statusShort,
                              minute: match.minute,
                              date: match.date,
                            })}
                            goalScorers={match.goalScorers}
                            broadcasters={match.broadcasters}
                            broadcastChannel={match.broadcastChannel}
                            broadcastLogoUrl={match.broadcastLogoUrl}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : dataError ? null : (
              <div className="w-full rounded-2xl border border-white/8 bg-[#0f1317]/92 px-2 py-5 text-sm text-[#94a0ae] md:px-4 md:py-6">
                No hay partidos cargados para la fecha seleccionada.
              </div>
            )}
          </main>
      </div>
      <LiveEventToasts
        date={selectedDate}
        enabled={hasLiveMatches}
        events={liveEvents}
        visibleFixtureIds={visibleFixtureIds}
      />
    </div>
  )
}

