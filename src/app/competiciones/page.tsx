import Image from 'next/image'
import Link from 'next/link'

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
  getTournamentExternalLeagueId,
  getTournamentLogoOverrideUrl,
  pickLeagueLogoUrl,
} from '@/shared/utils/asset-urls'

function resolveTournamentLogo(tournament: TournamentPageConfig) {
  return (
    getTournamentLogoOverrideUrl(tournament.key) ??
    pickLeagueLogoUrl(null, getTournamentExternalLeagueId(tournament.key))
  )
}

export async function generateMetadata() {
  return buildSeoMetadata({
    title: 'Competiciones | Hay Fulbo',
    description: 'Todas las competiciones disponibles en Hay Fulbo, agrupadas por categoria y pais.',
    path: '/competiciones',
  })
}

function getTournamentInitials(name: string) {
  const words = name
    .replace(/[^A-Za-z0-9À-ÿ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  return (words[0]?.[0] ?? 'H') + (words[1]?.[0] ?? words[0]?.[1] ?? 'F')
}

function CompetitionLogo({ tournament, name }: { tournament: TournamentPageConfig; name: string }) {
  const logo = resolveTournamentLogo(tournament)

  if (logo) {
    return (
      <span className="hf-directory-logo">
        <Image src={logo} alt="" width={44} height={44} className="h-11 w-11 object-contain" />
      </span>
    )
  }

  return (
    <span className="hf-directory-shield" aria-hidden="true">
      {getTournamentInitials(name).toUpperCase()}
    </span>
  )
}

export default async function CompetitionsPage() {
  const locale = await getRequestLocale()

  return (
    <main className="hf-directory-page">
      <section className="hf-directory-hero">
        <p>Competiciones</p>
        <h1>Todas las ligas y torneos</h1>
        <span>Elegí una competición para ver partidos, tablas, estadísticas y calendario.</span>
      </section>

      <div className="hf-directory-sections">
        {SIDEBAR_SECTION_CONFIGS.map((section) => {
          const sectionTitle = getSectionDisplayName(section.key, section.title, locale)

          return (
            <section key={section.key} id={section.key} className="hf-directory-section">
              <div className="hf-directory-section-head">
                <h2>{sectionTitle}</h2>
                <span>{section.tournaments.length} torneos</span>
              </div>

              <div className="hf-directory-grid">
                {section.tournaments.map((tournament) => {
                  const tournamentName = getTournamentDisplayName(tournament.key, tournament.title, locale)

                  return (
                    <Link
                      key={tournament.key}
                      href={`/liga/${tournament.key}`}
                      className="hf-directory-card"
                    >
                      <CompetitionLogo tournament={tournament} name={tournamentName} />
                      <span>{tournamentName}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
