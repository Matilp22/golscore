import Link from 'next/link'

import { SIDEBAR_SECTION_CONFIGS } from '@/lib/tournament-pages'
import { getRequestLocale } from '@/server/request-locale'
import {
  getSectionDisplayName,
  getTournamentDisplayName,
} from '@/shared/i18n/locales'
import { buildSeoMetadata } from '@/shared/seo'

export async function generateMetadata() {
  return buildSeoMetadata({
    title: 'Estadísticas | Hay Fulbo',
    description: 'Acceso rapido a estadisticas y rankings por competicion.',
    path: '/estadisticas',
  })
}

function getInitials(name: string) {
  const words = name
    .replace(/[^A-Za-z0-9À-ÿ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  return ((words[0]?.[0] ?? 'E') + (words[1]?.[0] ?? words[0]?.[1] ?? 'S')).toUpperCase()
}

export default async function StatsPage() {
  const locale = await getRequestLocale()

  return (
    <main className="hf-directory-page">
      <section className="hf-directory-hero">
        <p>Estadísticas</p>
        <h1>Rankings y datos por competición</h1>
        <span>Elegí un torneo para ver goleadores, asistencias, rendimiento y datos disponibles.</span>
      </section>

      <div className="hf-directory-sections">
        {SIDEBAR_SECTION_CONFIGS.map((section) => (
          <section key={section.key} className="hf-directory-section">
            <div className="hf-directory-section-head">
              <h2>{getSectionDisplayName(section.key, section.title, locale)}</h2>
              <span>{section.tournaments.length} torneos</span>
            </div>
            <div className="hf-directory-grid">
              {section.tournaments.map((tournament) => {
                const name = getTournamentDisplayName(tournament.key, tournament.title, locale)

                return (
                  <Link key={tournament.key} href={`/liga/${tournament.key}#estadisticas`} className="hf-directory-card">
                    <span className="hf-directory-shield" aria-hidden="true">{getInitials(name)}</span>
                    <span>{name}</span>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
