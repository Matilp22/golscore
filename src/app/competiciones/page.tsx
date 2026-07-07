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
  getTournamentLogoOverrideUrl,
  pickLeagueLogoUrl,
} from '@/shared/utils/asset-urls'

const TOURNAMENT_LEAGUE_EXTERNAL_IDS: Record<string, number> = {
  'argentina-liga-profesional': 128,
  'argentina-copa-argentina': 130,
  'internacional-libertadores': 13,
  'internacional-sudamericana': 11,
  'internacional-champions': 2,
  'internacional-europa-league': 3,
  'internacional-conference-league': 848,
  'internacional-concacaf-champions': 16,
  'inglaterra-premier-league': 39,
  'inglaterra-fa-cup': 45,
  'espana-la-liga': 140,
  'espana-copa-del-rey': 143,
  'italia-serie-a': 135,
  'italia-coppa-italia': 137,
  'alemania-bundesliga': 78,
  'alemania-dfb-pokal': 81,
  'portugal-primeira-liga': 94,
  'portugal-taca-de-portugal': 96,
  'francia-ligue-1': 61,
  'francia-copa-francia': 66,
  'brasil-brasileirao': 71,
  'brasil-copa-do-brasil': 73,
  'mexico-liga-mx': 262,
  'eeuu-mls': 253,
  'selecciones-mundial': 1,
  'selecciones-copa-america': 9,
  'selecciones-eurocopa': 4,
  'selecciones-uefa-nations-league': 5,
  'selecciones-eliminatorias-conmebol': 34,
  'selecciones-eliminatorias-uefa': 32,
  'selecciones-eliminatorias-concacaf': 31,
}

function resolveTournamentLogo(tournament: TournamentPageConfig) {
  return (
    getTournamentLogoOverrideUrl(tournament.key) ??
    pickLeagueLogoUrl(null, TOURNAMENT_LEAGUE_EXTERNAL_IDS[tournament.key])
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
