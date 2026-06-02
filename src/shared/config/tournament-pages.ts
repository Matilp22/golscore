import { isExcludedCompetition } from '@/shared/utils/competition-filter'

export type TournamentPageConfig = {
  key: string
  title: string
  sectionKey: string
  country?: string
  searchTerms: string[]
  showAnnualTable?: boolean
  showPromedios?: boolean
}

export type SidebarSectionConfig = {
  key: string
  title: string
  tournaments: TournamentPageConfig[]
}

export const SECTION_PAGE_TITLES: Record<string, string> = {
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

export const TOURNAMENT_PAGE_CONFIGS: TournamentPageConfig[] = [
  {
    key: 'argentina-liga-profesional',
    title: 'Liga Profesional',
    sectionKey: 'argentina',
    country: 'Argentina',
    searchTerms: ['Liga Profesional Argentina', 'Primera Division'],
    showAnnualTable: true,
    showPromedios: true,
  },
  {
    key: 'argentina-copa-argentina',
    title: 'Copa Argentina',
    sectionKey: 'argentina',
    country: 'Argentina',
    searchTerms: ['Copa Argentina'],
    showAnnualTable: false,
    showPromedios: false,
  },
  {
    key: 'argentina-reserva',
    title: 'Reserva',
    sectionKey: 'argentina',
    country: 'Argentina',
    searchTerms: ['Reserve League', 'Liga Profesional - Reserva', 'Reserve'],
    showAnnualTable: true,
    showPromedios: true,
  },
  {
    key: 'argentina-copa-de-la-liga-reserva',
    title: 'Copa de la Liga - Reserva',
    sectionKey: 'argentina',
    country: 'Argentina',
    searchTerms: ['Copa de la Liga - Reserva', 'Reserve Cup'],
    showAnnualTable: true,
    showPromedios: true,
  },
  {
    key: 'argentina-primera-nacional',
    title: 'Primera Nacional',
    sectionKey: 'argentina',
    country: 'Argentina',
    searchTerms: ['Primera Nacional'],
    showAnnualTable: false,
    showPromedios: false,
  },
  {
    key: 'argentina-primera-b-metro',
    title: 'Primera B Metro',
    sectionKey: 'argentina',
    country: 'Argentina',
    searchTerms: ['Primera B Metropolitana', 'Primera B'],
    showAnnualTable: false,
    showPromedios: false,
  },
  {
    key: 'argentina-federal-a',
    title: 'Federal A',
    sectionKey: 'argentina',
    country: 'Argentina',
    searchTerms: ['Federal A'],
    showAnnualTable: false,
    showPromedios: false,
  },
  {
    key: 'argentina-primera-c',
    title: 'Primera C',
    sectionKey: 'argentina',
    country: 'Argentina',
    searchTerms: ['Primera C'],
    showAnnualTable: false,
    showPromedios: false,
  },
  {
    key: 'argentina-promocional-amateur',
    title: 'Promocional Amateur',
    sectionKey: 'argentina',
    country: 'Argentina',
    searchTerms: ['Promocional Amateur', 'Primera D'],
    showAnnualTable: true,
    showPromedios: true,
  },
  {
    key: 'internacional-libertadores',
    title: 'Copa Libertadores',
    sectionKey: 'internacional',
    country: 'World',
    searchTerms: ['Copa Libertadores', 'CONMEBOL Libertadores'],
  },
  {
    key: 'internacional-sudamericana',
    title: 'Copa Sudamericana',
    sectionKey: 'internacional',
    country: 'World',
    searchTerms: ['Copa Sudamericana', 'CONMEBOL Sudamericana'],
  },
  {
    key: 'internacional-champions',
    title: 'Champions League',
    sectionKey: 'internacional',
    country: 'World',
    searchTerms: ['UEFA Champions League'],
  },
  {
    key: 'internacional-europa-league',
    title: 'Europa League',
    sectionKey: 'internacional',
    country: 'World',
    searchTerms: ['UEFA Europa League'],
  },
  {
    key: 'internacional-conference-league',
    title: 'Conference League',
    sectionKey: 'internacional',
    country: 'World',
    searchTerms: ['UEFA Europa Conference League'],
  },
  {
    key: 'internacional-concacaf-champions',
    title: 'Concacaf Champions',
    sectionKey: 'internacional',
    country: 'World',
    searchTerms: ['CONCACAF Champions Cup', 'Concacaf Champions Cup'],
  },
  {
    key: 'inglaterra-premier-league',
    title: 'Premier League',
    sectionKey: 'inglaterra',
    country: 'England',
    searchTerms: ['Premier League'],
  },
  {
    key: 'inglaterra-fa-cup',
    title: 'FA Cup',
    sectionKey: 'inglaterra',
    country: 'England',
    searchTerms: ['FA Cup'],
  },
  {
    key: 'espana-la-liga',
    title: 'La Liga',
    sectionKey: 'espana',
    country: 'Spain',
    searchTerms: ['La Liga'],
  },
  {
    key: 'espana-copa-del-rey',
    title: 'Copa del Rey',
    sectionKey: 'espana',
    country: 'Spain',
    searchTerms: ['Copa del Rey'],
  },
  {
    key: 'italia-serie-a',
    title: 'Serie A',
    sectionKey: 'italia',
    country: 'Italy',
    searchTerms: ['Serie A'],
  },
  {
    key: 'italia-coppa-italia',
    title: 'Coppa Italia',
    sectionKey: 'italia',
    country: 'Italy',
    searchTerms: ['Coppa Italia'],
  },
  {
    key: 'alemania-bundesliga',
    title: 'Bundesliga',
    sectionKey: 'alemania',
    country: 'Germany',
    searchTerms: ['Bundesliga'],
  },
  {
    key: 'alemania-dfb-pokal',
    title: 'DFB Pokal',
    sectionKey: 'alemania',
    country: 'Germany',
    searchTerms: ['DFB Pokal'],
  },
  {
    key: 'portugal-primeira-liga',
    title: 'Primeira Liga',
    sectionKey: 'portugal',
    country: 'Portugal',
    searchTerms: ['Primeira Liga'],
  },
  {
    key: 'portugal-taca-de-portugal',
    title: 'Taça de Portugal',
    sectionKey: 'portugal',
    country: 'Portugal',
    searchTerms: ['Taça de Portugal', 'Taca de Portugal'],
  },
  {
    key: 'francia-ligue-1',
    title: 'Ligue 1',
    sectionKey: 'francia',
    country: 'France',
    searchTerms: ['Ligue 1'],
  },
  {
    key: 'francia-copa-francia',
    title: 'Copa Francia',
    sectionKey: 'francia',
    country: 'France',
    searchTerms: ['Coupe de France'],
  },
  {
    key: 'brasil-brasileirao',
    title: 'Brasileirão',
    sectionKey: 'brasil',
    country: 'Brazil',
    searchTerms: ['Serie A', 'Brasileirão Serie A', 'Brasileirao Serie A'],
  },
  {
    key: 'brasil-copa-do-brasil',
    title: 'Copa do Brasil',
    sectionKey: 'brasil',
    country: 'Brazil',
    searchTerms: ['Copa do Brasil'],
  },
  {
    key: 'uruguay-primera-division',
    title: 'Primera División',
    sectionKey: 'uruguay',
    country: 'Uruguay',
    searchTerms: ['Primera División', 'Primera Division'],
  },
  {
    key: 'uruguay-copa-nacional',
    title: 'Copa Nacional',
    sectionKey: 'uruguay',
    country: 'Uruguay',
    searchTerms: ['Copa Uruguay', 'AUF Uruguay Cup'],
  },
  {
    key: 'paraguay-copa-de-primera',
    title: 'Copa de Primera',
    sectionKey: 'paraguay',
    country: 'Paraguay',
    searchTerms: ['División Profesional', 'Division Profesional', 'Copa de Primera'],
  },
  {
    key: 'paraguay-copa-paraguay',
    title: 'Copa Paraguay',
    sectionKey: 'paraguay',
    country: 'Paraguay',
    searchTerms: ['Copa Paraguay'],
  },
  {
    key: 'colombia-liga-betplay',
    title: 'Liga BetPlay',
    sectionKey: 'colombia',
    country: 'Colombia',
    searchTerms: ['Primera A', 'Liga BetPlay'],
  },
  {
    key: 'colombia-copa-colombia',
    title: 'Copa Colombia',
    sectionKey: 'colombia',
    country: 'Colombia',
    searchTerms: ['Copa Colombia'],
  },
  {
    key: 'chile-primera-division',
    title: 'Primera División',
    sectionKey: 'chile',
    country: 'Chile',
    searchTerms: ['Primera División', 'Primera Division'],
  },
  {
    key: 'chile-copa-chile',
    title: 'Copa Chile',
    sectionKey: 'chile',
    country: 'Chile',
    searchTerms: ['Copa Chile'],
  },
  {
    key: 'mexico-liga-mx',
    title: 'Liga MX',
    sectionKey: 'mexico',
    country: 'Mexico',
    searchTerms: ['Liga MX'],
  },
  {
    key: 'mexico-copa-mx',
    title: 'Copa MX',
    sectionKey: 'mexico',
    country: 'Mexico',
    searchTerms: ['Copa MX'],
  },
  {
    key: 'eeuu-mls',
    title: 'MLS',
    sectionKey: 'eeuu',
    country: 'USA',
    searchTerms: ['Major League Soccer'],
  },
  {
    key: 'eeuu-us-open-cup',
    title: 'US Open Cup',
    sectionKey: 'eeuu',
    country: 'USA',
    searchTerms: ['US Open Cup', 'U.S. Open Cup'],
  },
  {
    key: 'selecciones-mundial',
    title: 'Copa del Mundo 2026',
    sectionKey: 'selecciones',
    country: 'World',
    searchTerms: ['World Cup', 'FIFA World Cup', 'Mundial 2026', 'Mundial'],
  },
  {
    key: 'selecciones-copa-america',
    title: 'Copa América',
    sectionKey: 'selecciones',
    country: 'World',
    searchTerms: ['Copa América', 'Copa America'],
  },
  {
    key: 'selecciones-eurocopa',
    title: 'Eurocopa',
    sectionKey: 'selecciones',
    country: 'World',
    searchTerms: ['UEFA Euro'],
  },
  {
    key: 'selecciones-uefa-nations-league',
    title: 'UEFA Nations League',
    sectionKey: 'selecciones',
    country: 'World',
    searchTerms: ['UEFA Nations League'],
  },
  {
    key: 'selecciones-eliminatorias-conmebol',
    title: 'Eliminatorias Conmebol',
    sectionKey: 'selecciones',
    country: 'World',
    searchTerms: ['World Cup - Qualification South America'],
  },
  {
    key: 'selecciones-eliminatorias-uefa',
    title: 'Eliminatorias UEFA',
    sectionKey: 'selecciones',
    country: 'World',
    searchTerms: ['World Cup - Qualification Europe'],
  },
  {
    key: 'selecciones-eliminatorias-concacaf',
    title: 'Eliminatorias Concacaf',
    sectionKey: 'selecciones',
    country: 'World',
    searchTerms: ['World Cup - Qualification CONCACAF'],
  },
  {
    key: 'selecciones-eliminatorias-eurocopa',
    title: 'Eliminatorias Eurocopa',
    sectionKey: 'selecciones',
    country: 'World',
    searchTerms: ['UEFA Euro Qualification'],
  },
  {
    key: 'selecciones-repechaje-mundialista',
    title: 'Repechaje Mundialista',
    sectionKey: 'selecciones',
    country: 'World',
    searchTerms: ['World Cup - Qualification Intercontinental Play-offs'],
  },
]

export const VISIBLE_TOURNAMENT_PAGE_CONFIGS = TOURNAMENT_PAGE_CONFIGS.filter(
  (tournament) => !isExcludedCompetition(tournament)
)

export const SIDEBAR_SECTION_CONFIGS: SidebarSectionConfig[] = Object.keys(
  SECTION_PAGE_TITLES
)
  .map((sectionKey) => ({
    key: sectionKey,
    title: SECTION_PAGE_TITLES[sectionKey],
    tournaments: VISIBLE_TOURNAMENT_PAGE_CONFIGS.filter(
      (tournament) => tournament.sectionKey === sectionKey
    ),
  }))
  .filter((section) => section.tournaments.length > 0)

export function getSectionConfig(sectionKey: string) {
  return SIDEBAR_SECTION_CONFIGS.find((section) => section.key === sectionKey)
}

export function getTournamentConfig(tournamentKey: string) {
  return TOURNAMENT_PAGE_CONFIGS.find((tournament) => tournament.key === tournamentKey)
}
