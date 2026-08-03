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

type StatsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function StatsPage({ searchParams }: StatsPageProps) {
  const locale = await getRequestLocale()
  const params = searchParams ? await searchParams : {}
  const rawLeague = Array.isArray(params.liga) ? params.liga[0] : params.liga
  const allTournaments = SIDEBAR_SECTION_CONFIGS.flatMap((section) => section.tournaments)
  const selectedTournament = allTournaments.find((tournament) => tournament.key === rawLeague)
  const selectedName = selectedTournament
    ? getTournamentDisplayName(selectedTournament.key, selectedTournament.title, locale)
    : null

  return (
    <main className="hf-directory-page">
      <section className="hf-directory-hero">
        <p>Estadísticas</p>
        <h1>Rankings y datos por competición</h1>
        <span>Elegí un torneo para ver goleadores, asistencias, rendimiento y datos disponibles.</span>
      </section>

      {selectedTournament && selectedName ? (
        <section className="hf-stats-aggregate" aria-labelledby="stats-aggregate-title">
          <header>
            <div>
              <p className="hf-type-overline">Panel de torneo</p>
              <h2 id="stats-aggregate-title">{selectedName}</h2>
              <p>
                Este espacio queda separado de clasificación y fixture. Va a reunir métricas acumuladas de los partidos con datos confirmados.
              </p>
            </div>
            <Link href="/estadisticas">Cambiar liga</Link>
          </header>
          <div className="hf-stats-capability-grid">
            {[
              ['Goles', 'Por período, localía y tramo del partido'],
              ['Ataque', 'Remates, remates al arco y ocasiones'],
              ['Posesión y pases', 'Promedios y distribución por encuentro'],
              ['Defensa', 'Entradas, bloqueos, despejes y recuperaciones'],
              ['Pelota parada', 'Córners, faltas y saques de arco'],
              ['Disciplina', 'Tarjetas amarillas y rojas'],
            ].map(([title, description]) => (
              <article key={title}>
                <strong>{title}</strong>
                <span>{description}</span>
                <small>Agregación pendiente</small>
              </article>
            ))}
          </div>
          <p className="hf-stats-data-note" role="status">
            No mostramos valores simulados. La API entrega estadísticas por partido; falta consolidarlas por competencia y controlar cobertura antes de publicar totales.
          </p>
        </section>
      ) : null}

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
                  <Link key={tournament.key} href={`/estadisticas?liga=${tournament.key}`} className="hf-directory-card">
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
