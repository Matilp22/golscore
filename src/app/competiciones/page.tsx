import CompetitionDirectory from '@/frontend/components/competition/CompetitionDirectory'
import {
  SIDEBAR_SECTION_CONFIGS,
  type TournamentPageConfig,
} from '@/lib/tournament-pages'
import { getRequestLocale } from '@/server/request-locale'
import {
  getSectionDisplayName,
  getTournamentDisplayName,
} from '@/shared/i18n/locales'
import { buildSeoMetadata } from '@/shared/seo'
import {
  getOfficialTournamentLogoUrl,
} from '@/shared/utils/asset-urls'

function resolveTournamentLogo(tournament: TournamentPageConfig) {
  return getOfficialTournamentLogoUrl(tournament.key)
}

export async function generateMetadata() {
  return buildSeoMetadata({
    title: 'Competiciones | Hay Fulbo',
    description: 'Todas las competiciones disponibles en Hay Fulbo, agrupadas por categoría y país.',
    path: '/competiciones',
  })
}

function getTournamentInitials(name: string) {
  const words = name
    .replace(/[^A-Za-z0-9À-ÿ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  return ((words[0]?.[0] ?? 'H') + (words[1]?.[0] ?? words[0]?.[1] ?? 'F')).toUpperCase()
}

export default async function CompetitionsPage() {
  const locale = await getRequestLocale()
  const sections = SIDEBAR_SECTION_CONFIGS.map((section) => ({
    key: section.key,
    name: getSectionDisplayName(section.key, section.title, locale),
    items: section.tournaments.map((tournament) => {
      const name = getTournamentDisplayName(tournament.key, tournament.title, locale)

      return {
        key: tournament.key,
        name,
        href: `/liga/${tournament.key}`,
        logo: resolveTournamentLogo(tournament),
        initials: getTournamentInitials(name),
      }
    }),
  }))

  return (
    <CompetitionDirectory
      eyebrow="Mapa de competiciones"
      title="Todo el fútbol, bien ordenado"
      description="Encontrá ligas, copas y torneos internacionales. Cada competencia conserva sus partidos, formato, tablas y estadísticas reales."
      searchLabel="Filtrar competiciones"
      searchPlaceholder="Ej. Libertadores, Argentina, Premier…"
      emptyMessage="Probá con el nombre de una liga, copa, país o región."
      sections={sections}
    />
  )
}
