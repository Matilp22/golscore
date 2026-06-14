import Link from 'next/link'

import { getSectionConfig } from '@/lib/tournament-pages'
import { getRequestLocale } from '@/server/request-locale'
import {
  getSectionDisplayName,
  getTournamentDisplayName,
  t,
} from '@/shared/i18n/locales'
import { buildSeoMetadata } from '@/shared/seo'

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const locale = await getRequestLocale()
  const section = getSectionConfig(id)

  if (!section) {
    return buildSeoMetadata({
      title: `${t(locale, 'section.notFoundTitle')} | Hay Fulbo`,
      description: t(locale, 'section.notFoundDescription'),
      path: `/seccion/${id}`,
      noIndex: true,
    })
  }

  const sectionTitle = getSectionDisplayName(section.key, section.title, locale)

  return buildSeoMetadata({
    title: `${sectionTitle} | Hay Fulbo`,
    description:
      locale === 'es'
        ? `Explorá ligas de ${sectionTitle} con fixtures, tablas de posiciones, goleadores, asistencias y estadísticas en Hay Fulbo.`
        : `${sectionTitle} fixtures, standings, scorers and stats on Hay Fulbo.`,
    path: `/seccion/${id}`,
  })
}

export default async function SeccionPage({ params }: PageProps) {
  const { id } = await params
  const locale = await getRequestLocale()
  const section = getSectionConfig(id)

  if (!section) {
    return (
      <div className="min-h-screen bg-[#0a0d0b] px-2 py-3 text-white md:px-4 md:py-10">
        <div className="hf-card w-full max-w-none rounded-3xl p-4 md:mx-auto md:max-w-6xl md:p-6">
          <h1 className="text-2xl font-black">
            {t(locale, 'section.notFoundTitle')}
          </h1>
          <p className="mt-2 text-[#8d98a7]">
            {t(locale, 'section.notFoundDescription')}
          </p>
        </div>
      </div>
    )
  }

  const sectionTitle = getSectionDisplayName(section.key, section.title, locale)

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="w-full max-w-none px-0 py-3 lg:mx-auto lg:max-w-7xl lg:px-5 lg:py-6">
        <main className="min-w-0 space-y-4">
          <header className="hf-hero w-full overflow-hidden rounded-3xl px-3 py-5 md:px-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7ff0b2]">
              {t(locale, 'shell.sections')}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">
              {sectionTitle}
            </h1>
            <p className="mt-2 text-sm text-[#8d98a7]">
              {t(locale, 'section.chooseTournament')}
            </p>
          </header>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {section.tournaments.map((tournament) => {
              const tournamentTitle = getTournamentDisplayName(
                tournament.key,
                tournament.title,
                locale
              )

              return (
                <Link
                  key={tournament.key}
                  href={`/liga/${tournament.key}`}
                  className="hf-card hf-card-hover group w-full rounded-3xl p-4 md:p-5"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ff0b2]">
                    {sectionTitle}
                  </p>
                  <h2 className="mt-2 text-lg font-bold text-white">{tournamentTitle}</h2>
                  <p className="mt-3 text-sm text-[#94a0ae]">
                    {t(locale, 'section.cardDescription')}
                  </p>
                  <div className="mt-5 inline-flex rounded-full border border-white/8 px-3 py-1 text-xs font-semibold text-[#cfd7e1] transition group-hover:border-[#2b5d46] group-hover:text-white">
                    {t(locale, 'section.openTournament')}
                  </div>
                </Link>
              )
            })}
          </div>
        </main>
      </div>
    </div>
  )
}
