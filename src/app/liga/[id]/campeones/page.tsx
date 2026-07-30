import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { LeagueLogo, TeamLogo } from '@/frontend/components/AssetImage'
import { getTournamentConfig } from '@/lib/tournament-pages'
import { buildWorldCupChampionsViewModel } from '@/server/world-cup-champions'
import { buildSeoMetadata } from '@/shared/seo'
import { WORLD_CUP_2026_LOGO_URL } from '@/shared/utils/asset-urls'
import { translateCountryNameToSpanish } from '@/shared/utils/country-names'

type PageProps = {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const tournament = getTournamentConfig(id)

  if (tournament?.key !== 'selecciones-mundial') {
    return buildSeoMetadata({
      title: 'Historial no encontrado | Hay Fulbo',
      description: 'El historial solicitado no está disponible.',
      path: `/liga/${id}/campeones`,
      noIndex: true,
    })
  }

  return buildSeoMetadata({
    title: 'Campeones del Mundo: palmarés y finales | Hay Fulbo',
    description:
      'Todos los campeones, subcampeones, resultados y sedes de las finales de la Copa del Mundo desde 1930.',
    path: `/liga/${id}/campeones`,
  })
}

function formatVenue(
  venue: string | null,
  city: string | null,
  country: string | null
) {
  return (
    [venue, city, translateCountryNameToSpanish(country)]
      .filter(Boolean)
      .join(' · ') || 'Sede no disponible'
  )
}

export default async function WorldCupChampionsPage({ params }: PageProps) {
  const { id } = await params
  const tournament = getTournamentConfig(id)

  if (tournament?.key !== 'selecciones-mundial') {
    notFound()
  }

  const model = await buildWorldCupChampionsViewModel().catch(() => null)

  if (!model) {
    return (
      <main className="hf-champions-page">
        <section className="hf-champions-unavailable" role="alert">
          <p className="hf-type-overline">Historia del Mundial</p>
          <h1>No pudimos cargar el palmarés</h1>
          <p>
            El resto de la experiencia del Mundial sigue disponible. Volvé a
            intentar esta consulta más tarde.
          </p>
          <Link href={`/liga/${id}`}>Volver al Mundial 2026</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="hf-champions-page">
      <nav className="hf-champions-breadcrumbs" aria-label="Migas de pan">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/liga/${id}`}>Mundial 2026</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Campeones</span>
      </nav>

      <header className="hf-champions-hero">
        <div className="hf-champions-trophy">
          <LeagueLogo
            src={WORLD_CUP_2026_LOGO_URL}
            alt="Copa del Mundo 2026"
            size={72}
            className="h-[4.5rem] w-[4.5rem] object-contain"
            fallbackClassName="h-16 w-12"
            unoptimized
          />
        </div>
        <div>
          <p className="hf-type-overline">Archivo de la Copa del Mundo</p>
          <h1>Campeones del mundo</h1>
          <p>
            Palmarés, finales, resultados y sedes desde la primera edición de
            1930.
          </p>
        </div>
        <dl aria-label="Resumen histórico">
          <div>
            <dt>Ediciones</dt>
            <dd>{model.meta.totalFinals}</dd>
          </div>
          <div>
            <dt>Último campeón</dt>
            <dd>{model.meta.lastChampion ?? 'No disponible'}</dd>
          </div>
        </dl>
        <Link href={`/liga/${id}`} className="hf-button-secondary">
          Volver al Mundial 2026
        </Link>
      </header>

      <section
        className="hf-champions-ranking"
        aria-labelledby="champions-ranking-title"
      >
        <header>
          <p className="hf-type-overline">Palmarés</p>
          <h2 id="champions-ranking-title">Copas por selección</h2>
          <p>
            Alemania incluye los títulos obtenidos como Alemania Federal.
          </p>
        </header>
        <div className="hf-champions-ranking-grid">
          {model.titleCounts.map((row) => (
            <article key={row.canonicalTeamName}>
              <span className="hf-champions-rank">{row.rank}</span>
              <TeamLogo
                src={row.logoUrl}
                alt={row.teamName}
                size={44}
                className="h-11 w-11 object-contain"
                fallbackClassName="h-10 w-8"
                unoptimized
              />
              <div>
                <h3>{row.teamName}</h3>
                <p>{row.years.join(' · ')}</p>
                <small>
                  {row.runnerUps}{' '}
                  {row.runnerUps === 1 ? 'subcampeonato' : 'subcampeonatos'}
                </small>
              </div>
              <strong aria-label={`${row.titles} títulos`}>
                {row.titles}
                <span>{row.titles === 1 ? 'copa' : 'copas'}</span>
              </strong>
            </article>
          ))}
        </div>
      </section>

      <section
        className="hf-champions-finals"
        aria-labelledby="champions-finals-title"
      >
        <header>
          <p className="hf-type-overline">Partidos decisivos</p>
          <h2 id="champions-finals-title">Todas las finales</h2>
          <p>
            Los resultados con definición por penales muestran el marcador del
            partido y la tanda.
          </p>
        </header>

        <div>
          {model.finals.map((final) => (
            <article key={final.year} className="hf-champions-final">
              <time dateTime={String(final.year)}>{final.year}</time>
              <div className="hf-champions-final-match">
                <div>
                  <TeamLogo
                    src={final.championLogoUrl}
                    alt={final.champion}
                    size={30}
                    className="h-[1.875rem] w-[1.875rem] object-contain"
                    fallbackClassName="h-7 w-6"
                    unoptimized
                  />
                  <strong>{final.champion}</strong>
                  <span>Campeón</span>
                </div>
                <p>
                  <strong>{final.displayScore}</strong>
                  {final.decisiveMatch ? (
                    <span>Partido decisivo</span>
                  ) : final.afterExtraTime ? (
                    <span>Tiempo extra</span>
                  ) : null}
                </p>
                <div>
                  <TeamLogo
                    src={final.runnerUpLogoUrl}
                    alt={final.runnerUp}
                    size={30}
                    className="h-[1.875rem] w-[1.875rem] object-contain"
                    fallbackClassName="h-7 w-6"
                    unoptimized
                  />
                  <strong>{final.runnerUp}</strong>
                  <span>Subcampeón</span>
                </div>
              </div>
              <p className="hf-champions-final-venue">
                {formatVenue(final.venue, final.city, final.country)}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
