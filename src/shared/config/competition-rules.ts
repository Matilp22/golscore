import type { TournamentPageConfig } from '@/shared/config/tournament-pages'

export type CompetitionType =
  | 'league'
  | 'cup'
  | 'group_cup'
  | 'playoff'
  | 'qualification'

export type StandingsMode =
  | 'single'
  | 'groups'
  | 'none'
  | 'league_phase'
  | 'conferences'
  | 'zones'

export type RelegationMode =
  | 'none'
  | 'bottom_table'
  | 'bottom_table_with_playoff'
  | 'averages'
  | 'official_table_required'
  | 'api_description'

export type GroupMode =
  | 'none'
  | 'api_groups'
  | 'zones'
  | 'conferences'
  | 'league_phase'

export type BracketMode =
  | 'none'
  | 'knockout_rounds'
  | 'api_rounds'

export type RuleTone =
  | 'title'
  | 'champions'
  | 'libertadores'
  | 'europa'
  | 'sudamericana'
  | 'conference'
  | 'playoff'
  | 'relegationPlayoff'
  | 'relegation'

export type StandingRangeRule = {
  from: number
  to: number
  label: string
  tone: RuleTone
  note?: string
}

export type StandingLegendItem = {
  label: string
  tone: RuleTone
}

export type CompetitionRule = {
  key: string
  externalIds: number[]
  aliases: string[]
  visibleNameEs?: string
  countryNameEs?: string
  type: CompetitionType
  configuredType: CompetitionType
  standingsMode: StandingsMode
  hasAverages: boolean
  showPromedios: boolean
  hasRelegation: boolean
  relegationMode: RelegationMode
  groupMode: GroupMode
  bracketMode: BracketMode
  showBracket: boolean
  showAnnualTable?: boolean
  hideEmptyStandings?: boolean
  qualificationRules: StandingRangeRule[]
  relegationRules: StandingRangeRule[]
  playoffRules?: string[]
  roundLabels?: string[]
  legendItems?: StandingLegendItem[]
  sourceUsed: string[]
  warnings?: string[]
}

export const PROTECTED_COMPETITION_KEYS = new Set([
  'argentina-liga-profesional',
  'argentina-copa-argentina',
])

export const PROTECTED_COMPETITION_REASON = 'No tocar, ya configurada'

export const PROTECTED_COMPETITION_AUDIT: Record<
  string,
  {
    visibleNameEs: string
    countryNameEs: string
    skipped: true
    reason: typeof PROTECTED_COMPETITION_REASON
  }
> = {
  'argentina-liga-profesional': {
    visibleNameEs: 'Liga Profesional',
    countryNameEs: 'Argentina',
    skipped: true,
    reason: PROTECTED_COMPETITION_REASON,
  },
  'argentina-copa-argentina': {
    visibleNameEs: 'Copa Argentina',
    countryNameEs: 'Argentina',
    skipped: true,
    reason: PROTECTED_COMPETITION_REASON,
  },
}

export const ROW_TONE_CLASSES: Record<RuleTone, string> = {
  title: 'border-l-[#39e67a] bg-[#10301f]',
  champions: 'border-l-[#46d98e] bg-[#10261c]',
  libertadores: 'border-l-[#f1cc4a] bg-[#2d2610]',
  europa: 'border-l-sky-400 bg-sky-950/25',
  sudamericana: 'border-l-sky-400 bg-sky-950/25',
  conference: 'border-l-cyan-300 bg-cyan-950/20',
  playoff: 'border-l-[#d6a84f] bg-[#2a2414]',
  relegationPlayoff: 'border-l-[#fb923c] bg-orange-950/20',
  relegation: 'border-l-[#ff7e7e] bg-[#2a1616]',
}

export const LEGEND_TONE_CLASSES: Record<RuleTone, string> = {
  title: 'bg-[#39e67a]',
  champions: 'bg-[#46d98e]',
  libertadores: 'bg-[#f1cc4a]',
  europa: 'bg-sky-400',
  sudamericana: 'bg-sky-400',
  conference: 'bg-cyan-300',
  playoff: 'bg-[#d6a84f]',
  relegationPlayoff: 'bg-[#fb923c]',
  relegation: 'bg-[#ff7e7e]',
}

const apiDescriptionSource = 'API-Football standings.description cuando viene disponible'
const supabaseSource = 'Supabase leagues/matches/rounds detectados por auditoría'
const promiedosSource = 'Promiedos como referencia de torneos visibles'
const espnSource = 'ESPN Argentina como contraste de tablas/fixture'

export const GENERAL_COMPETITION_REFERENCE_SOURCES = [
  promiedosSource,
  espnSource,
] as const

const COUNTRY_NAME_ES_BY_VALUE: Record<string, string> = {
  argentina: 'Argentina',
  world: 'Internacional',
  internacional: 'Internacional',
  international: 'Internacional',
  england: 'Inglaterra',
  inglaterra: 'Inglaterra',
  spain: 'España',
  espana: 'España',
  españa: 'España',
  germany: 'Alemania',
  alemania: 'Alemania',
  italy: 'Italia',
  italia: 'Italia',
  france: 'Francia',
  francia: 'Francia',
  brazil: 'Brasil',
  brasil: 'Brasil',
  mexico: 'México',
  méxico: 'México',
  colombia: 'Colombia',
  chile: 'Chile',
  uruguay: 'Uruguay',
  paraguay: 'Paraguay',
  usa: 'EEUU',
  'united states': 'Estados Unidos',
  eeuu: 'EEUU',
  netherlands: 'Países Bajos',
  'paises bajos': 'Países Bajos',
  'países bajos': 'Países Bajos',
  belgium: 'Bélgica',
  belgica: 'Bélgica',
  bélgica: 'Bélgica',
  portugal: 'Portugal',
}

export const COMPETITION_NAME_ES: Record<string, string> = {
  'argentina-liga-profesional': 'Liga Profesional',
  'argentina-copa-argentina': 'Copa Argentina',
  'argentina-copa-de-la-liga': 'Copa de la Liga',
  'argentina-reserva': 'Reserva',
  'argentina-copa-de-la-liga-reserva': 'Copa de la Liga - Reserva',
  'argentina-primera-nacional': 'Primera Nacional',
  'argentina-primera-b-metro': 'Primera B Metro',
  'argentina-federal-a': 'Federal A',
  'argentina-primera-c': 'Primera C',
  'argentina-promocional-amateur': 'Promocional Amateur',
  'internacional-libertadores': 'Copa Libertadores',
  'internacional-sudamericana': 'Copa Sudamericana',
  'internacional-champions': 'Champions League',
  'internacional-copa-intercontinental': 'Copa Intercontinental',
  'internacional-europa-league': 'Europa League',
  'internacional-conference-league': 'Conference League',
  'internacional-mundial-de-clubes': 'Mundial de Clubes',
  'internacional-concacaf-champions': 'Concacaf Champions',
  'inglaterra-premier-league': 'Premier League',
  'inglaterra-carabao-cup': 'Carabao Cup',
  'inglaterra-fa-cup': 'FA Cup',
  'espana-la-liga': 'LaLiga',
  'espana-copa-del-rey': 'Copa del Rey',
  'espana-supercopa': 'Supercopa',
  'italia-serie-a': 'Serie A',
  'italia-coppa-italia': 'Coppa Italia',
  'italia-supercopa': 'Supercopa',
  'alemania-bundesliga': 'Bundesliga',
  'alemania-dfb-pokal': 'DFB Pokal',
  'portugal-primeira-liga': 'Primeira Liga',
  'portugal-taca-de-portugal': 'Taça de Portugal',
  'francia-ligue-1': 'Ligue 1',
  'francia-copa-francia': 'Copa Francia',
  'brasil-brasileirao': 'Brasileirão',
  'brasil-copa-do-brasil': 'Copa do Brasil',
  'uruguay-primera-division': 'Primera División',
  'uruguay-copa-nacional': 'Copa Uruguay',
  'paraguay-copa-de-primera': 'Copa de Primera',
  'paraguay-copa-paraguay': 'Copa Paraguay',
  'colombia-liga-betplay': 'Liga BetPlay',
  'colombia-copa-colombia': 'Copa Colombia',
  'chile-primera-division': 'Primera División',
  'chile-copa-chile': 'Copa Chile',
  'mexico-liga-mx': 'Liga MX',
  'mexico-copa-mx': 'Copa MX',
  'eeuu-mls': 'MLS',
  'eeuu-us-open-cup': 'US Open Cup',
  'selecciones-mundial-sub20': 'Mundial Sub-20',
  'selecciones-copa-america': 'Copa América',
  'selecciones-eliminatorias-conmebol': 'Eliminatorias Conmebol',
  'selecciones-eliminatorias-uefa': 'Eliminatorias UEFA',
  'selecciones-eurocopa': 'Eurocopa',
  'selecciones-uefa-nations-league': 'UEFA Nations League',
  'selecciones-eliminatorias-eurocopa': 'Eliminatorias Eurocopa',
  'selecciones-mundial': 'Mundial',
  'selecciones-sudamericano-sub20': 'Sudamericano Sub-20',
  'selecciones-eliminatorias-concacaf': 'Eliminatorias Concacaf',
  'selecciones-repechaje-mundialista': 'Repechaje Mundialista',
}

export const COMPETITION_COUNTRY_ES: Record<string, string> = {
  'argentina-liga-profesional': 'Argentina',
  'argentina-copa-argentina': 'Argentina',
  'argentina-copa-de-la-liga': 'Argentina',
  'argentina-reserva': 'Argentina',
  'argentina-copa-de-la-liga-reserva': 'Argentina',
  'argentina-primera-nacional': 'Argentina',
  'argentina-primera-b-metro': 'Argentina',
  'argentina-federal-a': 'Argentina',
  'argentina-primera-c': 'Argentina',
  'argentina-promocional-amateur': 'Argentina',
  'internacional-libertadores': 'Internacional',
  'internacional-sudamericana': 'Internacional',
  'internacional-champions': 'Internacional',
  'internacional-copa-intercontinental': 'Internacional',
  'internacional-europa-league': 'Internacional',
  'internacional-conference-league': 'Internacional',
  'internacional-mundial-de-clubes': 'Internacional',
  'internacional-concacaf-champions': 'Internacional',
  'inglaterra-premier-league': 'Inglaterra',
  'inglaterra-carabao-cup': 'Inglaterra',
  'inglaterra-fa-cup': 'Inglaterra',
  'espana-la-liga': 'España',
  'espana-copa-del-rey': 'España',
  'espana-supercopa': 'España',
  'italia-serie-a': 'Italia',
  'italia-coppa-italia': 'Italia',
  'italia-supercopa': 'Italia',
  'alemania-bundesliga': 'Alemania',
  'alemania-dfb-pokal': 'Alemania',
  'portugal-primeira-liga': 'Portugal',
  'portugal-taca-de-portugal': 'Portugal',
  'francia-ligue-1': 'Francia',
  'francia-copa-francia': 'Francia',
  'brasil-brasileirao': 'Brasil',
  'brasil-copa-do-brasil': 'Brasil',
  'uruguay-primera-division': 'Uruguay',
  'uruguay-copa-nacional': 'Uruguay',
  'paraguay-copa-de-primera': 'Paraguay',
  'paraguay-copa-paraguay': 'Paraguay',
  'colombia-liga-betplay': 'Colombia',
  'colombia-copa-colombia': 'Colombia',
  'chile-primera-division': 'Chile',
  'chile-copa-chile': 'Chile',
  'mexico-liga-mx': 'México',
  'mexico-copa-mx': 'México',
  'eeuu-mls': 'EEUU',
  'eeuu-us-open-cup': 'EEUU',
  'selecciones-mundial-sub20': 'Selecciones',
  'selecciones-copa-america': 'Selecciones',
  'selecciones-eliminatorias-conmebol': 'Selecciones',
  'selecciones-eliminatorias-uefa': 'Selecciones',
  'selecciones-eurocopa': 'Selecciones',
  'selecciones-uefa-nations-league': 'Selecciones',
  'selecciones-eliminatorias-eurocopa': 'Selecciones',
  'selecciones-mundial': 'Selecciones',
  'selecciones-sudamericano-sub20': 'Selecciones',
  'selecciones-eliminatorias-concacaf': 'Selecciones',
  'selecciones-repechaje-mundialista': 'Selecciones',
}

function leagueRule(
  rule: Omit<CompetitionRule, 'configuredType' | 'hideEmptyStandings' | 'bracketMode' | 'showBracket'>
): CompetitionRule {
  const hasPlayoffRounds = Boolean(rule.playoffRules?.length)

  return {
    ...rule,
    configuredType: rule.type,
    bracketMode: hasPlayoffRounds ? 'api_rounds' : 'none',
    showBracket: hasPlayoffRounds,
    hideEmptyStandings: false,
  }
}

function cupRule(
  rule: Omit<CompetitionRule, 'configuredType' | 'hideEmptyStandings'>
): CompetitionRule {
  return {
    ...rule,
    configuredType: rule.type,
    hideEmptyStandings: rule.standingsMode === 'none',
  }
}

const noRelegation = {
  hasRelegation: false,
  relegationMode: 'none' as const,
  relegationRules: [] as StandingRangeRule[],
}

export const COMPETITION_RULES: CompetitionRule[] = [
  cupRule({
    key: 'internacional-libertadores',
    externalIds: [13],
    aliases: ['Copa Libertadores', 'CONMEBOL Libertadores'],
    type: 'group_cup',
    standingsMode: 'groups',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'api_groups',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [
      { from: 1, to: 2, label: 'Octavos de final Copa Libertadores', tone: 'champions' },
      { from: 3, to: 3, label: 'Playoffs Copa Sudamericana', tone: 'sudamericana' },
    ],
    legendItems: [
      { label: 'Octavos de final Copa Libertadores', tone: 'champions' },
      { label: 'Playoffs Copa Sudamericana', tone: 'sudamericana' },
    ],
    playoffRules: ['Fase de grupos y eliminatorias cuando la API publica rounds finales.'],
    roundLabels: ['Grupos', 'Octavos', 'Cuartos', 'Semifinal', 'Final'],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'CONMEBOL reglamento/formato de competiciones'],
  }),
  cupRule({
    key: 'internacional-sudamericana',
    externalIds: [11],
    aliases: ['Copa Sudamericana', 'CONMEBOL Sudamericana'],
    type: 'group_cup',
    standingsMode: 'groups',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'api_groups',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [
      { from: 1, to: 1, label: 'Octavos de final Copa Sudamericana', tone: 'champions' },
      { from: 2, to: 2, label: 'Playoffs Copa Sudamericana', tone: 'sudamericana' },
    ],
    legendItems: [
      { label: 'Octavos de final Copa Sudamericana', tone: 'champions' },
      { label: 'Playoffs Copa Sudamericana', tone: 'sudamericana' },
    ],
    playoffRules: ['Grupos, playoff de octavos y eliminatorias si aparecen en rounds.'],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'CONMEBOL reglamento/formato de competiciones'],
  }),
  cupRule({
    key: 'internacional-champions',
    externalIds: [2],
    aliases: ['UEFA Champions League'],
    type: 'group_cup',
    standingsMode: 'league_phase',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'league_phase',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [
      { from: 1, to: 8, label: 'Octavos', tone: 'champions' },
      { from: 9, to: 24, label: 'Playoff eliminatorio', tone: 'playoff' },
    ],
    playoffRules: ['Top 8 a octavos; 9 a 24 a playoff; resto eliminado.'],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'UEFA formato 2024/25 de fase liga'],
  }),
  cupRule({
    key: 'internacional-europa-league',
    externalIds: [3],
    aliases: ['UEFA Europa League'],
    type: 'group_cup',
    standingsMode: 'league_phase',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'league_phase',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [
      { from: 1, to: 8, label: 'Octavos', tone: 'europa' },
      { from: 9, to: 24, label: 'Playoff eliminatorio', tone: 'playoff' },
    ],
    playoffRules: ['Top 8 a octavos; 9 a 24 a playoff; resto eliminado.'],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'UEFA formato 2024/25 de fase liga'],
  }),
  cupRule({
    key: 'internacional-conference-league',
    externalIds: [848],
    aliases: ['UEFA Europa Conference League', 'UEFA Conference League'],
    type: 'group_cup',
    standingsMode: 'league_phase',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'league_phase',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [
      { from: 1, to: 8, label: 'Octavos', tone: 'conference' },
      { from: 9, to: 24, label: 'Playoff eliminatorio', tone: 'playoff' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'UEFA formato 2024/25 de fase liga'],
  }),
  cupRule({
    key: 'internacional-concacaf-champions',
    externalIds: [16],
    aliases: ['CONCACAF Champions Cup', 'Concacaf Champions Cup'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [],
    playoffRules: ['Copa eliminatoria; no tabla general.'],
    sourceUsed: [supabaseSource, 'Concacaf formato Champions Cup'],
  }),
  leagueRule({
    key: 'inglaterra-premier-league',
    externalIds: [39],
    aliases: ['Premier League'],
    type: 'league',
    standingsMode: 'single',
    hasAverages: false,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'bottom_table',
    groupMode: 'none',
    qualificationRules: [
      { from: 1, to: 4, label: 'Champions League', tone: 'champions' },
      { from: 5, to: 5, label: 'Europa League', tone: 'europa' },
      { from: 6, to: 6, label: 'Conference League', tone: 'conference', note: 'Puede variar por copas.' },
    ],
    relegationRules: [
      { from: 18, to: 20, label: 'Descenso', tone: 'relegation' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'Premier League competition rules'],
    warnings: ['Cupos europeos pueden variar por campeones de copa o coeficientes UEFA.'],
  }),
  leagueRule({
    key: 'espana-la-liga',
    externalIds: [140],
    aliases: ['La Liga'],
    type: 'league',
    standingsMode: 'single',
    hasAverages: false,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'bottom_table',
    groupMode: 'none',
    qualificationRules: [
      { from: 1, to: 4, label: 'Champions League', tone: 'champions' },
      { from: 5, to: 5, label: 'Europa League', tone: 'europa' },
      { from: 6, to: 6, label: 'Conference League', tone: 'conference' },
    ],
    relegationRules: [
      { from: 18, to: 20, label: 'Descenso', tone: 'relegation' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'Reglamento/formatos LaLiga y UEFA'],
    warnings: ['Cupos europeos base; API description tiene prioridad si difiere.'],
  }),
  leagueRule({
    key: 'italia-serie-a',
    externalIds: [135],
    aliases: ['Serie A'],
    type: 'league',
    standingsMode: 'single',
    hasAverages: false,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'bottom_table',
    groupMode: 'none',
    qualificationRules: [
      { from: 1, to: 4, label: 'Champions League', tone: 'champions' },
      { from: 5, to: 5, label: 'Europa League', tone: 'europa' },
      { from: 6, to: 6, label: 'Conference League', tone: 'conference' },
    ],
    relegationRules: [
      { from: 18, to: 20, label: 'Descenso', tone: 'relegation' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'Lega Serie A/UEFA format rules'],
  }),
  leagueRule({
    key: 'alemania-bundesliga',
    externalIds: [78],
    aliases: ['Bundesliga'],
    type: 'league',
    standingsMode: 'single',
    hasAverages: false,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'bottom_table_with_playoff',
    groupMode: 'none',
    qualificationRules: [
      { from: 1, to: 4, label: 'Champions League', tone: 'champions' },
      { from: 5, to: 5, label: 'Europa League', tone: 'europa' },
      { from: 6, to: 6, label: 'Conference League', tone: 'conference' },
    ],
    relegationRules: [
      { from: 16, to: 16, label: 'Playoff descenso', tone: 'relegationPlayoff' },
      { from: 17, to: 18, label: 'Descenso', tone: 'relegation' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'Bundesliga relegation play-off format'],
  }),
  leagueRule({
    key: 'francia-ligue-1',
    externalIds: [61],
    aliases: ['Ligue 1'],
    type: 'league',
    standingsMode: 'single',
    hasAverages: false,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'bottom_table_with_playoff',
    groupMode: 'none',
    qualificationRules: [
      { from: 1, to: 3, label: 'Champions League', tone: 'champions' },
      { from: 4, to: 4, label: 'Champions League clasificatoria', tone: 'playoff' },
      { from: 5, to: 5, label: 'Europa League', tone: 'europa' },
      { from: 6, to: 6, label: 'Conference League', tone: 'conference' },
    ],
    relegationRules: [
      { from: 16, to: 16, label: 'Playoff descenso', tone: 'relegationPlayoff' },
      { from: 17, to: 18, label: 'Descenso', tone: 'relegation' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'Ligue 1/LFP and UEFA access list'],
  }),
  leagueRule({
    key: 'portugal-primeira-liga',
    externalIds: [94],
    aliases: ['Primeira Liga'],
    type: 'league',
    standingsMode: 'single',
    hasAverages: false,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'bottom_table_with_playoff',
    groupMode: 'none',
    qualificationRules: [
      { from: 1, to: 1, label: 'Champions League', tone: 'champions' },
      { from: 2, to: 2, label: 'Champions League clasificatoria', tone: 'playoff' },
      { from: 3, to: 3, label: 'Europa League', tone: 'europa' },
      { from: 4, to: 4, label: 'Conference League', tone: 'conference' },
    ],
    relegationRules: [
      { from: 16, to: 16, label: 'Playoff descenso', tone: 'relegationPlayoff' },
      { from: 17, to: 18, label: 'Descenso', tone: 'relegation' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'Liga Portugal format/access list'],
    warnings: ['Cupos europeos pueden moverse por campeón de copa.'],
  }),
  leagueRule({
    key: 'argentina-primera-nacional',
    externalIds: [129],
    aliases: ['Primera Nacional'],
    type: 'league',
    standingsMode: 'zones',
    hasAverages: false,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'api_description',
    groupMode: 'zones',
    showAnnualTable: false,
    qualificationRules: [
      { from: 1, to: 1, label: 'Final / ascenso según zona', tone: 'title' },
      { from: 2, to: 8, label: 'Reducido si aplica', tone: 'playoff' },
    ],
    relegationRules: [
      { from: 18, to: 18, label: 'Descenso por zona si API lo marca', tone: 'relegation' },
    ],
    playoffRules: ['Zonas y reducido según rounds publicados por API.'],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'AFA/Primera Nacional fixture rules'],
    warnings: ['No se calculan promedios: se evita heredar formato de Liga Profesional.'],
  }),
  leagueRule({
    key: 'argentina-primera-b-metro',
    externalIds: [131],
    aliases: ['Primera B Metropolitana', 'Primera B'],
    type: 'league',
    standingsMode: 'single',
    hasAverages: false,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'api_description',
    groupMode: 'none',
    showAnnualTable: false,
    qualificationRules: [
      { from: 1, to: 1, label: 'Final/ascenso si aplica', tone: 'title' },
      { from: 2, to: 8, label: 'Reducido si aplica', tone: 'playoff' },
    ],
    relegationRules: [],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'AFA divisional rules'],
    warnings: ['Descenso queda por description/API hasta confirmar reglamento exacto de temporada.'],
  }),
  leagueRule({
    key: 'argentina-federal-a',
    externalIds: [134],
    aliases: ['Federal A'],
    type: 'league',
    standingsMode: 'zones',
    hasAverages: false,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'api_description',
    groupMode: 'zones',
    showAnnualTable: false,
    qualificationRules: [
      { from: 1, to: 4, label: 'Fase final si aplica', tone: 'playoff' },
    ],
    relegationRules: [],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'Consejo Federal/AFA fixture rules'],
    warnings: ['Formato de zonas/fases se toma de API; descenso neutral si no viene marcado.'],
  }),
  leagueRule({
    key: 'argentina-primera-c',
    externalIds: [132],
    aliases: ['Primera C'],
    type: 'league',
    standingsMode: 'single',
    hasAverages: false,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'api_description',
    groupMode: 'none',
    showAnnualTable: false,
    qualificationRules: [
      { from: 1, to: 1, label: 'Ascenso/fase final si aplica', tone: 'title' },
      { from: 2, to: 8, label: 'Reducido si aplica', tone: 'playoff' },
    ],
    relegationRules: [],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'AFA divisional rules'],
    warnings: ['No se calculan promedios sin tabla oficial.'],
  }),
  leagueRule({
    key: 'brasil-brasileirao',
    externalIds: [71],
    aliases: ['Brasileirão Serie A', 'Brasileirao Serie A', 'Serie A'],
    type: 'league',
    standingsMode: 'single',
    hasAverages: false,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'bottom_table',
    groupMode: 'none',
    qualificationRules: [
      { from: 1, to: 6, label: 'Libertadores', tone: 'libertadores' },
      { from: 7, to: 12, label: 'Sudamericana', tone: 'sudamericana' },
    ],
    relegationRules: [
      { from: 17, to: 20, label: 'Descenso', tone: 'relegation' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'CBF/CONMEBOL access rules'],
    warnings: ['Cupos pueden variar por campeones de copas.'],
  }),
  leagueRule({
    key: 'uruguay-primera-division',
    externalIds: [268],
    aliases: ['Primera División', 'Primera Division'],
    type: 'league',
    standingsMode: 'groups',
    hasAverages: true,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'official_table_required',
    groupMode: 'api_groups',
    showAnnualTable: false,
    qualificationRules: [
      { from: 1, to: 1, label: 'Definición/anual según fase', tone: 'title' },
      { from: 2, to: 4, label: 'Copas internacionales si API lo marca', tone: 'sudamericana' },
    ],
    relegationRules: [],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'AUF Apertura/Clausura/anual'],
    warnings: ['Descenso por tabla oficial/promedios: no se computa si la API no trae esa tabla.'],
  }),
  leagueRule({
    key: 'paraguay-copa-de-primera',
    externalIds: [250],
    aliases: ['División Profesional', 'Division Profesional', 'Copa de Primera'],
    type: 'league',
    standingsMode: 'single',
    hasAverages: true,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'official_table_required',
    groupMode: 'none',
    qualificationRules: [
      { from: 1, to: 3, label: 'Libertadores/Sudamericana según acumulado', tone: 'libertadores' },
    ],
    relegationRules: [],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'APF reglamento temporada'],
    warnings: ['Tabla de promedios/acumulada oficial pendiente si API no la publica.'],
  }),
  leagueRule({
    key: 'colombia-liga-betplay',
    externalIds: [239],
    aliases: ['Primera A', 'Liga BetPlay'],
    type: 'league',
    standingsMode: 'groups',
    hasAverages: true,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'official_table_required',
    groupMode: 'api_groups',
    qualificationRules: [
      { from: 1, to: 8, label: 'Cuadrangulares/playoff', tone: 'playoff' },
    ],
    relegationRules: [],
    playoffRules: ['Fase regular y cuadrangulares/final si API publica grupos y rounds.'],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'Dimayor formato Liga BetPlay'],
    warnings: ['Descenso por promedio requiere tabla oficial; no se calcula con tabla simple.'],
  }),
  leagueRule({
    key: 'chile-primera-division',
    externalIds: [265],
    aliases: ['Primera División', 'Primera Division'],
    type: 'league',
    standingsMode: 'single',
    hasAverages: false,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'bottom_table',
    groupMode: 'none',
    qualificationRules: [
      { from: 1, to: 3, label: 'Libertadores', tone: 'libertadores' },
      { from: 4, to: 7, label: 'Sudamericana', tone: 'sudamericana' },
    ],
    relegationRules: [
      { from: 15, to: 16, label: 'Descenso', tone: 'relegation' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'ANFP bases de campeonato'],
  }),
  leagueRule({
    key: 'mexico-liga-mx',
    externalIds: [262],
    aliases: ['Liga MX'],
    type: 'playoff',
    standingsMode: 'single',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    qualificationRules: [
      { from: 1, to: 8, label: 'Liguilla', tone: 'playoff' },
    ],
    playoffRules: ['Clausura 2026 sin play-in: los ocho primeros acceden a Liguilla.'],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'Liga MX / ESPN Clausura 2026 sin play-in'],
    warnings: ['Sin descenso directo; revisar si Liga MX reintroduce play-in en torneos posteriores.'],
  }),
  leagueRule({
    key: 'eeuu-mls',
    externalIds: [253],
    aliases: ['Major League Soccer'],
    type: 'playoff',
    standingsMode: 'conferences',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'conferences',
    qualificationRules: [
      { from: 1, to: 7, label: 'MLS Cup Playoffs', tone: 'playoff' },
      { from: 8, to: 9, label: 'Wild Card', tone: 'relegationPlayoff' },
    ],
    playoffRules: ['Conferencias y playoffs; sin descenso.'],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'MLS competition guidelines'],
  }),
  cupRule({
    key: 'selecciones-mundial',
    externalIds: [1],
    aliases: ['World Cup'],
    type: 'group_cup',
    standingsMode: 'groups',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'api_groups',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [
      { from: 1, to: 2, label: 'Fase eliminatoria', tone: 'playoff' },
      { from: 3, to: 3, label: 'Mejores terceros si aplica', tone: 'relegationPlayoff' },
    ],
    playoffRules: ['Grupos y eliminatorias según formato FIFA y rounds de API.'],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'FIFA World Cup format'],
  }),
  cupRule({
    key: 'selecciones-copa-america',
    externalIds: [9],
    aliases: ['Copa América', 'Copa America'],
    type: 'group_cup',
    standingsMode: 'groups',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'api_groups',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [
      { from: 1, to: 2, label: 'Cuartos de final', tone: 'playoff' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'CONMEBOL Copa América format'],
  }),
  cupRule({
    key: 'selecciones-eurocopa',
    externalIds: [4],
    aliases: ['UEFA Euro'],
    type: 'group_cup',
    standingsMode: 'groups',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'api_groups',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [
      { from: 1, to: 2, label: 'Octavos', tone: 'playoff' },
      { from: 3, to: 3, label: 'Mejores terceros', tone: 'relegationPlayoff' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'UEFA Euro tournament format'],
  }),
  cupRule({
    key: 'selecciones-uefa-nations-league',
    externalIds: [5],
    aliases: ['UEFA Nations League'],
    type: 'group_cup',
    standingsMode: 'groups',
    hasAverages: false,
    showPromedios: false,
    hasRelegation: true,
    relegationMode: 'api_description',
    relegationRules: [
      { from: 4, to: 4, label: 'Descenso/playoff según liga', tone: 'relegation' },
    ],
    groupMode: 'api_groups',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [
      { from: 1, to: 2, label: 'Cuartos/playoff si aplica', tone: 'playoff' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'UEFA Nations League format'],
    warnings: ['Reglas cambian por League A/B/C/D; API description tiene prioridad.'],
  }),
  leagueRule({
    key: 'selecciones-eliminatorias-conmebol',
    externalIds: [34],
    aliases: ['World Cup - Qualification South America'],
    type: 'qualification',
    standingsMode: 'single',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    qualificationRules: [
      { from: 1, to: 6, label: 'Mundial', tone: 'playoff' },
      { from: 7, to: 7, label: 'Repechaje', tone: 'relegationPlayoff' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'FIFA qualification format'],
  }),
  leagueRule({
    key: 'selecciones-eliminatorias-uefa',
    externalIds: [32],
    aliases: ['World Cup - Qualification Europe'],
    type: 'qualification',
    standingsMode: 'groups',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'api_groups',
    qualificationRules: [
      { from: 1, to: 1, label: 'Mundial', tone: 'playoff' },
      { from: 2, to: 2, label: 'Playoff', tone: 'relegationPlayoff' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'UEFA/FIFA qualification format'],
  }),
  leagueRule({
    key: 'selecciones-eliminatorias-concacaf',
    externalIds: [31],
    aliases: ['World Cup - Qualification CONCACAF'],
    type: 'qualification',
    standingsMode: 'groups',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'api_groups',
    qualificationRules: [
      { from: 1, to: 1, label: 'Ronda siguiente/Mundial', tone: 'playoff' },
      { from: 2, to: 2, label: 'Puede clasificar según fase', tone: 'relegationPlayoff' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'Concacaf/FIFA qualification format'],
    warnings: ['Formato por rondas; description/API tiene prioridad.'],
  }),
  leagueRule({
    key: 'selecciones-eliminatorias-eurocopa',
    externalIds: [960],
    aliases: ['UEFA Euro Qualification'],
    type: 'qualification',
    standingsMode: 'groups',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'api_groups',
    qualificationRules: [
      { from: 1, to: 2, label: 'Eurocopa', tone: 'playoff' },
    ],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'UEFA Euro qualification format'],
  }),
  cupRule({
    key: 'selecciones-repechaje-mundialista',
    externalIds: [15],
    aliases: ['World Cup - Qualification Intercontinental Play-offs'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [],
    sourceUsed: [apiDescriptionSource, supabaseSource, 'FIFA intercontinental play-off format'],
  }),
  cupRule({
    key: 'inglaterra-fa-cup',
    externalIds: [45],
    aliases: ['FA Cup'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [],
    sourceUsed: [supabaseSource, 'The FA competition format'],
  }),
  cupRule({
    key: 'espana-copa-del-rey',
    externalIds: [143],
    aliases: ['Copa del Rey'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [],
    sourceUsed: [supabaseSource, 'RFEF Copa del Rey format'],
  }),
  cupRule({
    key: 'italia-coppa-italia',
    externalIds: [137],
    aliases: ['Coppa Italia'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [],
    sourceUsed: [supabaseSource, 'Lega Serie A Coppa Italia format'],
  }),
  cupRule({
    key: 'alemania-dfb-pokal',
    externalIds: [81],
    aliases: ['DFB Pokal'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [],
    sourceUsed: [supabaseSource, 'DFB Pokal format'],
  }),
  cupRule({
    key: 'portugal-taca-de-portugal',
    externalIds: [96],
    aliases: ['Taça de Portugal', 'Taca de Portugal'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [],
    sourceUsed: [supabaseSource, 'FPF Taça de Portugal format'],
  }),
  cupRule({
    key: 'francia-copa-francia',
    externalIds: [66],
    aliases: ['Coupe de France'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [],
    sourceUsed: [supabaseSource, 'FFF Coupe de France format'],
  }),
  cupRule({
    key: 'brasil-copa-do-brasil',
    externalIds: [73],
    aliases: ['Copa Do Brasil'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [],
    sourceUsed: [supabaseSource, 'CBF Copa do Brasil format'],
  }),
  cupRule({
    key: 'uruguay-copa-nacional',
    externalIds: [930],
    aliases: ['Copa Uruguay', 'AUF Uruguay Cup'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [],
    sourceUsed: [supabaseSource, 'AUF Copa Uruguay format'],
  }),
  cupRule({
    key: 'paraguay-copa-paraguay',
    externalIds: [252],
    aliases: ['Copa Paraguay'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [],
    sourceUsed: [supabaseSource, 'APF Copa Paraguay format'],
  }),
  cupRule({
    key: 'colombia-copa-colombia',
    externalIds: [240],
    aliases: ['Copa Colombia'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [],
    sourceUsed: [supabaseSource, 'Dimayor Copa Colombia format'],
  }),
  cupRule({
    key: 'chile-copa-chile',
    externalIds: [267],
    aliases: ['Copa Chile'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [],
    sourceUsed: [supabaseSource, 'ANFP Copa Chile format'],
  }),
  cupRule({
    key: 'mexico-copa-mx',
    externalIds: [263],
    aliases: ['Copa MX'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'none',
    showBracket: false,
    qualificationRules: [],
    sourceUsed: [supabaseSource],
    warnings: ['Competencia puede no estar vigente; neutral si no hay fixtures.'],
  }),
  cupRule({
    key: 'eeuu-us-open-cup',
    externalIds: [257],
    aliases: ['US Open Cup', 'U.S. Open Cup'],
    type: 'cup',
    standingsMode: 'none',
    hasAverages: false,
    showPromedios: false,
    ...noRelegation,
    groupMode: 'none',
    bracketMode: 'knockout_rounds',
    showBracket: true,
    qualificationRules: [],
    sourceUsed: [supabaseSource, 'US Soccer Open Cup format'],
  }),
]

const RULES_BY_KEY = new Map(COMPETITION_RULES.map((rule) => [rule.key, rule]))
const RULES_BY_EXTERNAL_ID = new Map(
  COMPETITION_RULES.flatMap((rule) =>
    rule.externalIds.map((externalId) => [externalId, rule] as const)
  )
)

function getDefaultLegendItems(rule: CompetitionRule) {
  const seen = new Set<string>()
  const items: StandingLegendItem[] = []

  for (const rangeRule of [...rule.qualificationRules, ...rule.relegationRules]) {
    const key = `${rangeRule.label}:${rangeRule.tone}`
    if (seen.has(key)) continue

    seen.add(key)
    items.push({ label: rangeRule.label, tone: rangeRule.tone })
  }

  return items
}

function normalizeRuleText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function hasAnyRuleText(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern))
}

export function getStandingDescriptionRule(
  description: string | null | undefined
): StandingLegendItem | null {
  const normalized = normalizeRuleText(description)
  if (!normalized) return null

  const hasPlayoffText = hasAnyRuleText(normalized, [
    'playoff',
    'play-off',
    'play offs',
    'play-offs',
    'repechaje',
    'promocion',
    'promocion',
    'liguilla',
    'reduced',
    'reducido',
  ])
  const hasRelegationText = hasAnyRuleText(normalized, [
    'relegation',
    'descenso',
  ])

  if (hasRelegationText && hasPlayoffText) {
    return { label: 'Playoff descenso', tone: 'relegationPlayoff' }
  }

  if (hasRelegationText) {
    return { label: 'Descenso', tone: 'relegation' }
  }

  if (normalized.includes('champions league')) {
    return { label: 'Champions League', tone: 'champions' }
  }

  if (normalized.includes('libertadores')) {
    return { label: 'Libertadores', tone: 'libertadores' }
  }

  if (normalized.includes('europa league')) {
    return { label: 'Europa League', tone: 'europa' }
  }

  if (normalized.includes('sudamericana')) {
    return { label: 'Sudamericana', tone: 'sudamericana' }
  }

  if (normalized.includes('conference league')) {
    return { label: 'Conference League', tone: 'conference' }
  }

  if (normalized.includes('world cup') || normalized.includes('mundial')) {
    return { label: 'Mundial', tone: 'playoff' }
  }

  if (normalized.includes('euro') && !normalized.includes('europa league')) {
    return { label: 'Eurocopa', tone: 'playoff' }
  }

  if (hasPlayoffText) {
    return { label: 'Playoffs', tone: 'playoff' }
  }

  if (hasAnyRuleText(normalized, ['promotion', 'clasificacion', 'qualification'])) {
    return { label: 'Clasificación', tone: 'playoff' }
  }

  return null
}

export function getCompetitionLegendItems(rule: CompetitionRule | null) {
  if (!rule) return []

  return rule.legendItems ?? getDefaultLegendItems(rule)
}

export function isProtectedCompetitionKey(key: string | null | undefined) {
  return Boolean(key && PROTECTED_COMPETITION_KEYS.has(key))
}

export function getProtectedCompetitionAudit(key: string | null | undefined) {
  return key ? PROTECTED_COMPETITION_AUDIT[key] ?? null : null
}

export function translateCountryNameEs(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const normalized = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  return COUNTRY_NAME_ES_BY_VALUE[normalized] ?? trimmed
}

export function getCompetitionVisibleNameEs(
  key: string | null | undefined,
  fallback: string | null | undefined
) {
  if (key && COMPETITION_NAME_ES[key]) return COMPETITION_NAME_ES[key]

  return fallback?.trim() || 'Torneo'
}

export function getCompetitionCountryNameEs(
  key: string | null | undefined,
  fallback: string | null | undefined
) {
  if (key && COMPETITION_COUNTRY_ES[key]) return COMPETITION_COUNTRY_ES[key]

  return translateCountryNameEs(fallback) ?? 'Torneo'
}

export function getCompetitionRule(key: string | null | undefined) {
  return key ? RULES_BY_KEY.get(key) ?? null : null
}

export function getCompetitionRuleByExternalId(externalId: number | string | null | undefined) {
  if (externalId === null || externalId === undefined) return null

  const normalized = Number(externalId)
  if (!Number.isFinite(normalized)) return null

  return RULES_BY_EXTERNAL_ID.get(normalized) ?? null
}

export function getStandingRuleForRank(
  rule: CompetitionRule | null,
  rank: number
) {
  if (!rule) return null

  return [...rule.qualificationRules, ...rule.relegationRules]
    .find((rangeRule) => rank >= rangeRule.from && rank <= rangeRule.to) ?? null
}

export function getTournamentDisplayOptions(tournament: TournamentPageConfig) {
  if (PROTECTED_COMPETITION_KEYS.has(tournament.key)) {
    const protectedAudit = getProtectedCompetitionAudit(tournament.key)

    return {
      protected: true,
      skipped: true,
      reason: protectedAudit?.reason ?? PROTECTED_COMPETITION_REASON,
      visibleNameEs: protectedAudit?.visibleNameEs ?? tournament.title,
      countryNameEs: protectedAudit?.countryNameEs ?? tournament.country ?? 'Torneo',
      rule: null,
      standingsMode: 'single' as StandingsMode,
      groupMode: 'api_groups' as GroupMode,
      bracketMode: 'api_rounds' as BracketMode,
      showAnnualTable: Boolean(tournament.showAnnualTable),
      showPromedios: Boolean(tournament.showPromedios),
      showBracket: true,
      hideEmptyStandings: false,
      legendItems: [] as Array<{ label: string; tone: RuleTone }>,
      hasAverages: Boolean(tournament.showPromedios),
      hasRelegation: Boolean(tournament.showPromedios || tournament.showAnnualTable),
      relegationMode: 'api_description' as RelegationMode,
    }
  }

  const rule = getCompetitionRule(tournament.key)

  return {
    protected: false,
    skipped: false,
    reason: null,
    visibleNameEs: getCompetitionVisibleNameEs(
      tournament.key,
      rule?.visibleNameEs ?? tournament.title
    ),
    countryNameEs: getCompetitionCountryNameEs(
      tournament.key,
      rule?.countryNameEs ?? tournament.country
    ),
    rule,
    standingsMode: rule?.standingsMode ?? 'single',
    groupMode: rule?.groupMode ?? 'api_groups',
    bracketMode: rule?.bracketMode ?? 'api_rounds',
    showAnnualTable: Boolean(rule?.showAnnualTable ?? false),
    showPromedios: Boolean(rule?.showPromedios ?? false),
    showBracket: rule?.showBracket ?? true,
    hideEmptyStandings: Boolean(rule?.hideEmptyStandings),
    legendItems: getCompetitionLegendItems(rule),
    hasAverages: Boolean(rule?.hasAverages),
    hasRelegation: Boolean(rule?.hasRelegation),
    relegationMode: rule?.relegationMode ?? 'api_description',
  }
}
