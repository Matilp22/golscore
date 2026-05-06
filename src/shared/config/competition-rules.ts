import type { TournamentPageConfig } from '@/shared/config/tournament-pages'

export type CompetitionType = 'league' | 'cup' | 'group_cup' | 'playoff' | 'qualification'
export type StandingsMode = 'single' | 'groups' | 'none' | 'annual' | 'averages'

export type CompetitionRule = {
  key: string
  externalIds: number[]
  type: CompetitionType
  standingsMode: StandingsMode
  showBracket: boolean
  showAnnualTable?: boolean
  showPromedios?: boolean
  qualificationRules?: string[]
  relegationRules?: string[]
  roundLabelRules?: string[]
  notes?: string[]
}

export const PROTECTED_COMPETITION_KEYS = new Set([
  'argentina-liga-profesional',
  'argentina-copa-argentina',
])

export const COMPETITION_RULES: CompetitionRule[] = [
  {
    key: 'internacional-libertadores',
    externalIds: [13],
    type: 'group_cup',
    standingsMode: 'groups',
    showBracket: true,
    qualificationRules: ['Fase de grupos y eliminatorias segun rondas de API-Football.'],
    roundLabelRules: ['Grupos, octavos, cuartos, semifinal y final.'],
  },
  {
    key: 'internacional-sudamericana',
    externalIds: [11],
    type: 'group_cup',
    standingsMode: 'groups',
    showBracket: true,
    qualificationRules: ['Fase de grupos, playoff/octavos y eliminatorias si la API las publica.'],
  },
  {
    key: 'internacional-champions',
    externalIds: [2],
    type: 'group_cup',
    standingsMode: 'single',
    showBracket: true,
    qualificationRules: ['Tabla de liga/fase inicial y eliminatorias segun descripciones de API.'],
  },
  {
    key: 'internacional-europa-league',
    externalIds: [3],
    type: 'group_cup',
    standingsMode: 'single',
    showBracket: true,
  },
  {
    key: 'internacional-conference-league',
    externalIds: [848],
    type: 'group_cup',
    standingsMode: 'single',
    showBracket: true,
  },
  {
    key: 'internacional-concacaf-champions',
    externalIds: [16],
    type: 'cup',
    standingsMode: 'none',
    showBracket: true,
  },
  {
    key: 'inglaterra-premier-league',
    externalIds: [39],
    type: 'league',
    standingsMode: 'single',
    showBracket: false,
    qualificationRules: ['Usar description de API para Champions/Europa/Conference cuando exista.'],
    relegationRules: ['Usar description de API; fallback visual de descenso solo si viene marcado.'],
  },
  {
    key: 'espana-la-liga',
    externalIds: [140],
    type: 'league',
    standingsMode: 'single',
    showBracket: false,
    qualificationRules: ['Usar description de API para Champions/Europa/Conference cuando exista.'],
    relegationRules: ['Usar description de API para descenso.'],
  },
  {
    key: 'italia-serie-a',
    externalIds: [135],
    type: 'league',
    standingsMode: 'single',
    showBracket: false,
    qualificationRules: ['Usar description de API para Champions/Europa/Conference cuando exista.'],
    relegationRules: ['Usar description de API para descenso.'],
  },
  {
    key: 'alemania-bundesliga',
    externalIds: [78],
    type: 'league',
    standingsMode: 'single',
    showBracket: false,
    qualificationRules: ['Usar description de API para Champions/Europa/Conference cuando exista.'],
    relegationRules: ['Usar description de API para descenso/playoff descenso.'],
  },
  {
    key: 'francia-ligue-1',
    externalIds: [61],
    type: 'league',
    standingsMode: 'single',
    showBracket: false,
    qualificationRules: ['Usar description de API para Champions/Europa/Conference cuando exista.'],
    relegationRules: ['Usar description de API para descenso/playoff.'],
  },
  {
    key: 'portugal-primeira-liga',
    externalIds: [94],
    type: 'league',
    standingsMode: 'single',
    showBracket: false,
    qualificationRules: ['Usar description de API para copas europeas cuando exista.'],
    relegationRules: ['Usar description de API para descenso/playoff.'],
  },
  {
    key: 'argentina-primera-nacional',
    externalIds: [129],
    type: 'league',
    standingsMode: 'groups',
    showBracket: true,
    showAnnualTable: true,
    showPromedios: true,
    qualificationRules: ['Zonas y reducido/playoff si la API publica fases.'],
  },
  {
    key: 'argentina-primera-b-metro',
    externalIds: [131],
    type: 'league',
    standingsMode: 'single',
    showBracket: true,
    showAnnualTable: true,
    showPromedios: true,
  },
  {
    key: 'argentina-federal-a',
    externalIds: [134],
    type: 'league',
    standingsMode: 'groups',
    showBracket: true,
    showAnnualTable: true,
    showPromedios: true,
  },
  {
    key: 'argentina-primera-c',
    externalIds: [132],
    type: 'league',
    standingsMode: 'single',
    showBracket: true,
    showAnnualTable: true,
    showPromedios: true,
  },
  {
    key: 'brasil-brasileirao',
    externalIds: [71],
    type: 'league',
    standingsMode: 'single',
    showBracket: false,
    qualificationRules: ['Usar description de API para Libertadores/Sudamericana.'],
    relegationRules: ['Usar description de API para descenso.'],
  },
  {
    key: 'uruguay-primera-division',
    externalIds: [268],
    type: 'league',
    standingsMode: 'groups',
    showBracket: true,
    qualificationRules: ['Apertura/Clausura/anual si la API publica grupos o tablas derivadas.'],
  },
  {
    key: 'paraguay-copa-de-primera',
    externalIds: [250],
    type: 'league',
    standingsMode: 'single',
    showBracket: false,
  },
  {
    key: 'colombia-liga-betplay',
    externalIds: [239],
    type: 'league',
    standingsMode: 'groups',
    showBracket: true,
    qualificationRules: ['Todos contra todos y cuadrangulares/playoffs si la API los publica.'],
  },
  {
    key: 'chile-primera-division',
    externalIds: [265],
    type: 'league',
    standingsMode: 'single',
    showBracket: false,
  },
  {
    key: 'mexico-liga-mx',
    externalIds: [262],
    type: 'playoff',
    standingsMode: 'single',
    showBracket: true,
    qualificationRules: ['Fase regular y liguilla/play-in si la API publica rondas.'],
  },
  {
    key: 'eeuu-mls',
    externalIds: [253],
    type: 'playoff',
    standingsMode: 'groups',
    showBracket: true,
    qualificationRules: ['Conferencias y playoffs si la API publica fases.'],
  },
  {
    key: 'selecciones-mundial',
    externalIds: [1],
    type: 'group_cup',
    standingsMode: 'groups',
    showBracket: true,
    qualificationRules: ['Grupos y eliminatorias; no mostrar tabla anual ni promedios.'],
  },
  {
    key: 'selecciones-copa-america',
    externalIds: [9],
    type: 'group_cup',
    standingsMode: 'groups',
    showBracket: true,
  },
  {
    key: 'selecciones-eurocopa',
    externalIds: [4],
    type: 'group_cup',
    standingsMode: 'groups',
    showBracket: true,
  },
  {
    key: 'selecciones-eliminatorias-conmebol',
    externalIds: [34],
    type: 'qualification',
    standingsMode: 'single',
    showBracket: false,
  },
  {
    key: 'selecciones-eliminatorias-uefa',
    externalIds: [32],
    type: 'qualification',
    standingsMode: 'groups',
    showBracket: false,
  },
  {
    key: 'selecciones-eliminatorias-concacaf',
    externalIds: [31],
    type: 'qualification',
    standingsMode: 'groups',
    showBracket: false,
  },
]

const RULES_BY_KEY = new Map(COMPETITION_RULES.map((rule) => [rule.key, rule]))
const RULES_BY_EXTERNAL_ID = new Map(
  COMPETITION_RULES.flatMap((rule) =>
    rule.externalIds.map((externalId) => [externalId, rule] as const)
  )
)

export function getCompetitionRule(key: string | null | undefined) {
  return key ? RULES_BY_KEY.get(key) ?? null : null
}

export function getCompetitionRuleByExternalId(externalId: number | string | null | undefined) {
  if (externalId === null || externalId === undefined) return null

  const normalized = Number(externalId)
  if (!Number.isFinite(normalized)) return null

  return RULES_BY_EXTERNAL_ID.get(normalized) ?? null
}

export function getTournamentDisplayOptions(tournament: TournamentPageConfig) {
  if (PROTECTED_COMPETITION_KEYS.has(tournament.key)) {
    return {
      showAnnualTable: Boolean(tournament.showAnnualTable),
      showPromedios: Boolean(tournament.showPromedios),
      showBracket: true,
    }
  }

  const rule = getCompetitionRule(tournament.key)

  return {
    showAnnualTable: Boolean(rule?.showAnnualTable ?? tournament.showAnnualTable),
    showPromedios: Boolean(rule?.showPromedios ?? tournament.showPromedios),
    showBracket: rule?.showBracket ?? true,
  }
}
