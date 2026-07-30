import CompetitionDirectory from '@/frontend/components/competition/CompetitionDirectory'
import { SIDEBAR_SECTION_CONFIGS } from '@/lib/tournament-pages'
import { getRequestLocale } from '@/server/request-locale'
import {
  getSectionDisplayName,
  getTournamentDisplayName,
} from '@/shared/i18n/locales'
import { buildSeoMetadata } from '@/shared/seo'

export async function generateMetadata() {
  return buildSeoMetadata({
    title: 'Tablas | Hay Fulbo',
    description: 'Acceso rápido a las tablas de posiciones por competición.',
    path: '/tablas',
  })
}

function getInitials(name: string) {
  const words = name
    .replace(/[^A-Za-z0-9À-ÿ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  return ((words[0]?.[0] ?? 'T') + (words[1]?.[0] ?? words[0]?.[1] ?? 'B')).toUpperCase()
}

export default async function TablesPage() {
  const locale = await getRequestLocale()
  const sections = SIDEBAR_SECTION_CONFIGS.map((section) => ({
    key: section.key,
    name: getSectionDisplayName(section.key, section.title, locale),
    items: section.tournaments.map((tournament) => {
      const name = getTournamentDisplayName(tournament.key, tournament.title, locale)

      return {
        key: tournament.key,
        name,
        href: `/liga/${tournament.key}#tabla`,
        initials: getInitials(name),
      }
    }),
  }))

  return (
    <CompetitionDirectory
      eyebrow="Centro de tablas"
      title="Posiciones sin vueltas"
      description="Accedé a la clasificación de cada competencia. Si el torneo tiene zonas, grupos o promedios, vas a encontrar su estructura completa."
      searchLabel="Filtrar tablas"
      searchPlaceholder="Ej. Liga Profesional, Champions…"
      emptyMessage="No encontramos una tabla con ese nombre o región."
      sections={sections}
    />
  )
}
