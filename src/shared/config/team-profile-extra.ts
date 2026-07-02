export type TeamInfoFact = {
  label: string
  value: string
}

export type TeamSelectionFacts = {
  source: string
  updatedAt: string
  worldCup: TeamInfoFact[]
  titles: TeamInfoFact[]
}

const DEFAULT_SELECTION_FACTS: TeamSelectionFacts = {
  source: 'Config manual Hay Fulbo',
  updatedAt: '2026-07-02',
  worldCup: [
    { label: 'Mundiales jugados', value: 'No disponible' },
    { label: 'Mundiales ganados', value: 'No disponible' },
    { label: 'Finales jugadas', value: 'No disponible' },
    { label: 'Mejor actuacion', value: 'No disponible' },
    { label: 'Goles totales', value: 'No disponible' },
  ],
  titles: [
    { label: 'Ranking FIFA', value: 'No disponible' },
    { label: 'Copas continentales', value: 'No disponible' },
    { label: 'Otras copas', value: 'No disponible' },
  ],
}

const SELECTION_FACTS_BY_NAME: Record<string, TeamSelectionFacts> = {
  argentina: {
    source: 'Config manual Hay Fulbo',
    updatedAt: '2026-07-02',
    worldCup: [
      { label: 'Mundiales jugados', value: '18' },
      { label: 'Mundiales ganados', value: '3' },
      { label: 'Finales jugadas', value: '6' },
      { label: 'Mejor actuacion', value: 'Campeon: 1978, 1986, 2022' },
      { label: 'Goles totales', value: '152' },
    ],
    titles: [
      { label: 'Ranking FIFA', value: 'Dato a sincronizar' },
      { label: 'Copas continentales', value: '16 Copa America' },
      { label: 'Otras copas', value: '1 Finalissima, 1 Copa Confederaciones' },
    ],
  },
  brasil: {
    source: 'Config manual Hay Fulbo',
    updatedAt: '2026-07-02',
    worldCup: [
      { label: 'Mundiales jugados', value: '22' },
      { label: 'Mundiales ganados', value: '5' },
      { label: 'Finales jugadas', value: '7' },
      { label: 'Mejor actuacion', value: 'Campeon: 1958, 1962, 1970, 1994, 2002' },
      { label: 'Goles totales', value: '237' },
    ],
    titles: [
      { label: 'Ranking FIFA', value: 'Dato a sincronizar' },
      { label: 'Copas continentales', value: '9 Copa America' },
      { label: 'Otras copas', value: '4 Copa Confederaciones' },
    ],
  },
  francia: {
    source: 'Config manual Hay Fulbo',
    updatedAt: '2026-07-02',
    worldCup: [
      { label: 'Mundiales jugados', value: '16' },
      { label: 'Mundiales ganados', value: '2' },
      { label: 'Finales jugadas', value: '4' },
      { label: 'Mejor actuacion', value: 'Campeon: 1998, 2018' },
      { label: 'Goles totales', value: '136' },
    ],
    titles: [
      { label: 'Ranking FIFA', value: 'Dato a sincronizar' },
      { label: 'Copas continentales', value: '2 Eurocopas' },
      { label: 'Otras copas', value: '2 Confederaciones, 1 Nations League' },
    ],
  },
  alemania: {
    source: 'Config manual Hay Fulbo',
    updatedAt: '2026-07-02',
    worldCup: [
      { label: 'Mundiales jugados', value: '20' },
      { label: 'Mundiales ganados', value: '4' },
      { label: 'Finales jugadas', value: '8' },
      { label: 'Mejor actuacion', value: 'Campeon: 1954, 1974, 1990, 2014' },
      { label: 'Goles totales', value: '232' },
    ],
    titles: [
      { label: 'Ranking FIFA', value: 'Dato a sincronizar' },
      { label: 'Copas continentales', value: '3 Eurocopas' },
      { label: 'Otras copas', value: '1 Copa Confederaciones' },
    ],
  },
  espana: {
    source: 'Config manual Hay Fulbo',
    updatedAt: '2026-07-02',
    worldCup: [
      { label: 'Mundiales jugados', value: '16' },
      { label: 'Mundiales ganados', value: '1' },
      { label: 'Finales jugadas', value: '1' },
      { label: 'Mejor actuacion', value: 'Campeon: 2010' },
      { label: 'Goles totales', value: '108' },
    ],
    titles: [
      { label: 'Ranking FIFA', value: 'Dato a sincronizar' },
      { label: 'Copas continentales', value: '4 Eurocopas' },
      { label: 'Otras copas', value: '1 Nations League' },
    ],
  },
  uruguay: {
    source: 'Config manual Hay Fulbo',
    updatedAt: '2026-07-02',
    worldCup: [
      { label: 'Mundiales jugados', value: '14' },
      { label: 'Mundiales ganados', value: '2' },
      { label: 'Finales jugadas', value: '2' },
      { label: 'Mejor actuacion', value: 'Campeon: 1930, 1950' },
      { label: 'Goles totales', value: '89' },
    ],
    titles: [
      { label: 'Ranking FIFA', value: 'Dato a sincronizar' },
      { label: 'Copas continentales', value: '15 Copa America' },
      { label: 'Otras copas', value: '2 JJ.OO. reconocidos por FIFA' },
    ],
  },
  mexico: {
    source: 'Config manual Hay Fulbo',
    updatedAt: '2026-07-02',
    worldCup: [
      { label: 'Mundiales jugados', value: '17' },
      { label: 'Mundiales ganados', value: '0' },
      { label: 'Finales jugadas', value: '0' },
      { label: 'Mejor actuacion', value: 'Cuartos de final: 1970, 1986' },
      { label: 'Goles totales', value: '60' },
    ],
    titles: [
      { label: 'Ranking FIFA', value: 'Dato a sincronizar' },
      { label: 'Copas continentales', value: '12 Copa Oro/Concacaf' },
      { label: 'Otras copas', value: '1 Confederaciones' },
    ],
  },
  inglaterra: {
    source: 'Config manual Hay Fulbo',
    updatedAt: '2026-07-02',
    worldCup: [
      { label: 'Mundiales jugados', value: '16' },
      { label: 'Mundiales ganados', value: '1' },
      { label: 'Finales jugadas', value: '1' },
      { label: 'Mejor actuacion', value: 'Campeon: 1966' },
      { label: 'Goles totales', value: '104' },
    ],
    titles: [
      { label: 'Ranking FIFA', value: 'Dato a sincronizar' },
      { label: 'Copas continentales', value: '0' },
      { label: 'Otras copas', value: 'No disponible' },
    ],
  },
}

function normalizeSelectionFactKey(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}

export function getTeamSelectionFacts(name: string) {
  const normalized = normalizeSelectionFactKey(name)
  const aliases: Record<string, string> = {
    brazil: 'brasil',
    france: 'francia',
    germany: 'alemania',
    spain: 'espana',
    england: 'inglaterra',
    mex: 'mexico',
  }
  const key = aliases[normalized] ?? normalized

  return SELECTION_FACTS_BY_NAME[key] ?? DEFAULT_SELECTION_FACTS
}
