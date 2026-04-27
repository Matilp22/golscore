export const revalidate = 30

import AutoRefresh from '@/frontend/components/AutoRefresh'
import MatchRow from '@/frontend/components/MatchRow'
import Image from 'next/image'
import Link from 'next/link'
import {
  ApiFootballError,
  getMatchesByDate,
  type MatchListItem,
} from '@/lib/api-football'
import {
  getSectionConfig,
} from '@/lib/tournament-pages'
import { isFinishedStatus, isLiveStatus as isActiveLiveStatus } from '@/shared/utils/match-status'

function getBuenosAiresTodayISO() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(new Date())
}

function addDaysToISO(isoDate: string, amount: number) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utcDate = new Date(Date.UTC(year, month - 1, day))
  utcDate.setUTCDate(utcDate.getUTCDate() + amount)

  const y = utcDate.getUTCFullYear()
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(utcDate.getUTCDate()).padStart(2, '0')

  return `${y}-${m}-${d}`
}

function formatMatchTime(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function formatStatus(statusShort: string, minute: number | null) {
  if (statusShort === '1H' || statusShort === '2H' || statusShort === 'ET') {
    return minute ? `EN VIVO ${minute}'` : 'EN VIVO'
  }

  if (statusShort === 'HT') return 'ENTRETIEMPO'
  if (isFinishedStatus(statusShort)) return 'FINAL'
  if (statusShort === 'NS') return 'PRÓXIMO'

  return statusShort
}

function isLiveStatus(statusShort: string) {
  return isActiveLiveStatus(statusShort)
}

type ApiMatch = MatchListItem

type CompetitionBucket = {
  key: string
  title: string
  logo?: string
  sectionKey: string
  sectionTitle: string
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

function sortMatches(matches: ApiMatch[]) {
  return [...matches].sort((a, b) => {
    const aLive = a.statusShort !== 'NS' ? 0 : 1
    const bLive = b.statusShort !== 'NS' ? 0 : 1

    if (aLive !== bLive) return aLive - bLive
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })
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
}

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
      leagueText(match).includes('premier league') &&
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
      leagueText(match).includes('la liga') &&
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
      leagueText(match).includes('serie a') &&
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
      leagueText(match).includes('bundesliga') &&
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
    baseTitle: 'Taca de Portugal',
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
      leagueText(match).includes('ligue 1') &&
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

function groupMatchesWithPromiedosStructure(matches: ApiMatch[]): SectionBucket[] {
  const cleanMatches = matches.filter((match) => !isYouthLeague(match))
  const assignedMatchIds = new Set<number>()
  const competitionBuckets: CompetitionBucket[] = []

  for (const rule of LEAGUE_RULES) {
    const filtered = cleanMatches.filter((match) => {
      if (assignedMatchIds.has(match.id)) return false
      return rule.match(match)
    })

    if (filtered.length === 0) continue

    competitionBuckets.push({
      key: rule.key,
      title: rule.baseTitle,
      logo: filtered[0]?.leagueLogo,
      sectionKey: rule.sectionKey,
      sectionTitle: rule.sectionTitle,
      matches: sortMatches(filtered),
    })

    filtered.forEach((match) => assignedMatchIds.add(match.id))
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

  const todayISO = getBuenosAiresTodayISO()
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
  let dateMatches: MatchListItem[] = []

  let dataError: string | null = null

  try {
    dateMatches = await getMatchesByDate(selectedDate)
    groupedSections = groupMatchesWithPromiedosStructure(dateMatches)
  } catch (error) {
    if (error instanceof ApiFootballError) {
      dataError =
        error.code === 'requests'
          ? 'Se alcanzó el límite diario de la API. Los partidos no pudieron cargarse ahora mismo.'
          : error.message
    } else {
      dataError = 'No se pudieron cargar los partidos en este momento.'
    }
  }

  const visibleSections = groupedSections.filter(
    (section) => section.competitions.length > 0
  )
  const hasLiveMatches = dateMatches.some((match) => isLiveStatus(match.statusShort))
  const refreshIntervalMs = hasLiveMatches ? 60000 : 300000
  const renderedAt = new Date().toISOString()

  return (
    <div className="min-h-screen overflow-x-hidden bg-transparent text-white">
      <div className="w-full px-0 py-3 lg:mx-auto lg:max-w-7xl lg:px-5 lg:py-6">
        <header className="relative mb-4 w-full rounded-2xl bg-[#111418]/95 px-2 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.16)] sm:px-3 md:px-4 md:py-4">
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/prode"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#25553d] bg-[#163828] px-4 py-2 text-sm font-semibold text-[#7ff0b2] transition hover:bg-[#1b4330]"
            >
              Prode
            </Link>
            <AutoRefresh
              intervalMs={refreshIntervalMs}
              showButton
              initialUpdatedAt={renderedAt}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <h1 className="max-w-full break-words text-[2.65rem] font-black leading-none tracking-normal text-white sm:text-5xl md:text-7xl">
                GolScore
              </h1>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#7ff0b2] md:text-sm">
                Partidos del día
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-center">
              {dayOptions.map((day) => (
                <a
                  key={day.value}
                  href={`/?date=${day.value}`}
                  className={`flex min-h-11 items-center justify-center rounded-lg border px-2 py-2 text-center text-sm font-semibold transition sm:px-3 ${
                    selectedDate === day.value
                      ? 'border-[#2d6d4d] bg-[#163828] text-[#7ff0b2]'
                      : 'border-white/8 bg-[#15191e] text-[#c7d0da] hover:border-white/14 hover:bg-[#181d23]'
                  }`}
                >
                  {day.label}
                </a>
              ))}
            </div>
          </div>
        </header>

          <main className="min-w-0 space-y-4">
            {dataError ? (
              <div className="rounded-2xl border border-[#5a2a2a] bg-[#3b1919] p-6">
                <p className="text-sm font-medium text-[#ffd5d5]">
                  {dataError}
                </p>
              </div>
            ) : null}

            {visibleSections.length ? (
              visibleSections.map((section) => (
                <section
                  id={section.key}
                  key={section.key}
                  className="w-full min-w-0 overflow-hidden rounded-2xl border border-white/8 bg-[#0f1317]/92"
                >
                  <div className="border-b border-white/6 bg-[#13181d] px-3 py-3 sm:px-4">
                    <h2 className="text-base font-bold text-white md:text-lg">
                      {section.title}
                    </h2>
                  </div>

                  <div className="divide-y divide-white/6">
                    {section.competitions.map((competition) => (
                      <div
                        id={competition.key}
                        key={competition.key}
                        className="scroll-mt-5 px-0 py-0"
                      >
                        <div className="border-b border-white/6 bg-[#12171c] px-3 py-3 sm:px-4">
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              {competition.logo ? (
                                <div className="flex h-8 w-8 items-center justify-center">
                                  <Image
                                    src={competition.logo}
                                    alt={competition.title}
                                    width={24}
                                    height={24}
                                    className="h-6 w-6 object-contain"
                                  />
                                </div>
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center">
                                  <span className="h-5 w-4 bg-[#6f7884] [clip-path:polygon(50%_0,92%_16%,84%_72%,50%_100%,16%_72%,8%_16%)]" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <h3 className="break-words text-sm font-semibold text-[#f3f6fa] md:text-base">
                                  {competition.title}
                                </h3>
                              </div>
                            </div>

                            <div className="shrink-0 rounded-md bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94a0ae] sm:px-2.5 sm:text-[11px]">
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
                              time={formatMatchTime(match.date)}
                              minute={match.minute ? `${match.minute}'` : ''}
                              home={match.home}
                              away={match.away}
                              score={`${match.goalsHome ?? '-'} - ${match.goalsAway ?? '-'}`}
                              status={formatStatus(match.statusShort, match.minute)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            ) : dataError ? null : (
              <div className="w-full rounded-2xl border border-white/8 bg-[#0f1317]/92 px-2 py-5 text-sm text-[#94a0ae] md:px-4 md:py-6">
                No hay partidos cargados para la fecha seleccionada.
              </div>
            )}
          </main>
      </div>
    </div>
  )
}

