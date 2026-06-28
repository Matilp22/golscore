import { countWords } from '@/shared/content-quality'

export type CompetitionEditorialIntroData = {
  competitionKey: string
  eyebrow: string
  title: string
  paragraphs: string[]
  formatTitle: string
  formatBullets: string[]
  analysisLinks: Array<{
    slug: string
    label: string
  }>
}

const COMPETITION_EDITORIAL_INTROS: Record<string, CompetitionEditorialIntroData> = {
  'selecciones-mundial': {
    competitionKey: 'selecciones-mundial',
    eyebrow: 'Guia editorial',
    title: 'Como seguir la Copa del Mundo 2026 en Hay Fulbo',
    paragraphs: [
      'La Copa del Mundo 2026 cambia la escala del torneo: 48 selecciones, mas partidos y una primera fase donde los terceros puestos tambien pueden entrar en la cuenta. En Hay Fulbo la cobertura combina fixture, grupos, tabla de terceros y cruces para que el recorrido de cada seleccion se pueda leer sin perder el contexto.',
      'El foco de esta pagina es separar dato confirmado de escenario posible. Los resultados, posiciones y llaves salen del sistema deportivo; el bloque editorial explica el formato, los criterios generales de lectura y que mirar cuando dos equipos llegan igualados.',
    ],
    formatTitle: 'Formato que se muestra en la pagina',
    formatBullets: [
      'Fase de grupos con doce zonas de cuatro selecciones.',
      'Clasifican los dos primeros de cada grupo y los ocho mejores terceros.',
      'La fase eliminatoria arranca en 16avos y continua hasta la final.',
      'Los cruces se leen desde los datos disponibles y pueden actualizarse cuando cambia una posicion.',
    ],
    analysisLinks: [
      {
        slug: 'copa-del-mundo-2026-formato-guia',
        label: 'Guia del formato del Mundial 2026',
      },
      {
        slug: 'como-leer-tablas-fixtures-hay-fulbo',
        label: 'Como leer tablas y fixtures',
      },
    ],
  },
  'internacional-libertadores': {
    competitionKey: 'internacional-libertadores',
    eyebrow: 'Guia editorial',
    title: 'Copa Libertadores: grupos, cruces y lectura de la llave',
    paragraphs: [
      'La Libertadores mezcla una fase de grupos extensa con eliminatorias de alta variacion. Por eso la pagina prioriza tres niveles de lectura: tabla por grupo, calendario inmediato y llave, cuando la competicion ya tiene cruces definidos o proyectables desde los datos cargados.',
      'El contenido editorial acompana la cobertura con explicaciones sobre avances de ronda, definiciones por serie y uso de penales. No reemplaza el dato del partido: lo contextualiza para que el usuario entienda que parte pertenece al fixture, que parte a la tabla y que parte a la fase eliminatoria.',
    ],
    formatTitle: 'Formato que se muestra en la pagina',
    formatBullets: [
      'Grupos con posiciones, puntos, goles y diferencia.',
      'Agenda de partidos por fase cuando hay fixture disponible.',
      'Llave eliminatoria para octavos, cuartos, semifinales y final.',
      'Marcadores con penales visibles cuando la serie o el partido se define desde el punto penal.',
    ],
    analysisLinks: [
      {
        slug: 'copa-libertadores-formato-guia',
        label: 'Guia para leer la Libertadores',
      },
      {
        slug: 'como-leer-tablas-fixtures-hay-fulbo',
        label: 'Como leer tablas y fixtures',
      },
    ],
  },
  'internacional-champions': {
    competitionKey: 'internacional-champions',
    eyebrow: 'Guia editorial',
    title: 'Champions League: fase liga y camino a los cruces',
    paragraphs: [
      'La Champions actual ya no se entiende como ocho grupos tradicionales. La fase liga concentra a todos los equipos en una tabla comun, con cortes que determinan clasificacion directa, playoffs o eliminacion. La pagina refleja ese esquema para que la tabla no se lea como una liga domestica comun.',
      'El bloque editorial explica los cortes principales y como se conectan con la fase eliminatoria. La intencion es que el usuario pueda distinguir entre posicion parcial, cupo de playoff y llave posterior sin depender de textos genericos o de una tabla sin contexto.',
    ],
    formatTitle: 'Formato que se muestra en la pagina',
    formatBullets: [
      'Tabla unica de fase liga con posiciones de todos los equipos.',
      'Primeros puestos con acceso directo a octavos.',
      'Zona intermedia que juega playoffs de acceso a octavos.',
      'Equipos fuera del corte eliminados de la competicion europea principal.',
    ],
    analysisLinks: [
      {
        slug: 'champions-league-fase-liga-guia',
        label: 'Guia de la fase liga de Champions',
      },
      {
        slug: 'como-leer-tablas-fixtures-hay-fulbo',
        label: 'Como leer tablas y fixtures',
      },
    ],
  },
  'argentina-liga-profesional': {
    competitionKey: 'argentina-liga-profesional',
    eyebrow: 'Guia editorial',
    title: 'Liga Profesional Argentina: tabla, anual y promedios',
    paragraphs: [
      'La Liga Profesional Argentina tiene una lectura mas amplia que la tabla del torneo en curso. En Hay Fulbo la pagina separa la competencia principal, la tabla anual y los promedios cuando corresponden, porque cada una responde a una pregunta distinta: quien compite arriba, quien suma para copas y quien queda comprometido abajo.',
      'El contenido editorial busca ordenar esas capas sin alterar el dato deportivo. Los puntos, partidos y goles vienen de la cobertura de resultados; la explicacion muestra como interpretar las secciones y por que una misma fecha puede mover mas de una tabla.',
    ],
    formatTitle: 'Formato que se muestra en la pagina',
    formatBullets: [
      'Fixture por fechas y fases cuando la temporada lo requiere.',
      'Tabla del torneo para posiciones del campeonato vigente.',
      'Tabla anual cuando aplica para clasificaciones acumuladas.',
      'Promedios cuando el reglamento de la temporada los mantiene relevantes.',
    ],
    analysisLinks: [
      {
        slug: 'liga-profesional-argentina-tabla-anual-promedios',
        label: 'Guia de tabla anual y promedios',
      },
      {
        slug: 'como-leer-tablas-fixtures-hay-fulbo',
        label: 'Como leer tablas y fixtures',
      },
    ],
  },
}

export const EDITORIAL_COMPETITION_KEYS = Object.keys(COMPETITION_EDITORIAL_INTROS)

export function getCompetitionEditorialIntro(competitionKey: string) {
  return COMPETITION_EDITORIAL_INTROS[competitionKey] ?? null
}

export function getCompetitionEditorialWordCount(competitionKey: string) {
  const intro = getCompetitionEditorialIntro(competitionKey)
  if (!intro) return 0

  return countWords([
    intro.title,
    ...intro.paragraphs,
    intro.formatTitle,
    ...intro.formatBullets,
    ...intro.analysisLinks.map((link) => link.label),
  ].join(' '))
}
