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
    title: 'Tablas | Hay Fulbo',
    description: 'Acceso rapido a las tablas de posiciones por competicion.',
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

  return (
    <main className="hf-directory-page">
      <section className="hf-directory-hero">
        <p>Tablas</p>
        <h1>Posiciones por competición</h1>
        <span>Entrá a una competición para revisar su tabla, grupos y contexto deportivo.</span>
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
                  <Link key={tournament.key} href={`/liga/${tournament.key}#posiciones`} className="hf-directory-card">
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
