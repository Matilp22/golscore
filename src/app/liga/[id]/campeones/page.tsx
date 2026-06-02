import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'

import { LeagueLogo, TeamLogo } from '@/frontend/components/AssetImage'
import { getTournamentConfig } from '@/lib/tournament-pages'
import { getTournamentTheme } from '@/lib/tournament-themes'
import { buildWorldCupChampionsViewModel } from '@/server/world-cup-champions'
import { WORLD_CUP_2026_LOGO_URL } from '@/shared/utils/asset-urls'

type PageProps = {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function WorldCupChampionsPage({ params }: PageProps) {
  const { id } = await params
  const tournament = getTournamentConfig(id)

  if (tournament?.key !== 'selecciones-mundial') {
    notFound()
  }

  const model = await buildWorldCupChampionsViewModel()
  const theme = getTournamentTheme(tournament.key)
  const themeStyle = {
    background: theme.background,
    boxShadow: theme.glow,
    '--tournament-accent': theme.accent,
  } as CSSProperties

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="w-full max-w-none px-0 py-3 lg:mx-auto lg:max-w-7xl lg:px-5 lg:py-6">
        <main className="w-full min-w-0 space-y-4">
          <header
            className="relative w-full overflow-hidden rounded-3xl border border-white/8"
            style={themeStyle}
          >
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.035)_0_1px,transparent_1px_54px)] opacity-45" />
            <div className="relative flex flex-col gap-4 px-3 py-4 md:flex-row md:items-center md:justify-between md:px-5 md:py-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center">
                  <LeagueLogo
                    src={WORLD_CUP_2026_LOGO_URL}
                    alt="Copa del Mundo 2026"
                    size={56}
                    className="h-14 w-14 object-contain"
                    fallbackClassName="h-12 w-10"
                    unoptimized
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--tournament-accent)]">
                    Historial
                  </p>
                  <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">
                    Campeones de la Copa del Mundo
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-[#c5ced8]">
                    Finales, campeones y palmarés histórico de la Copa del Mundo desde 1930
                  </p>
                </div>
              </div>

              <Link
                href={`/liga/${id}`}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-[#10151a]/80 px-4 py-2 text-sm font-black text-[#dce5ef] transition hover:border-[#f6ca58]/60 hover:text-white md:self-center"
              >
                Volver a Copa del Mundo 2026
              </Link>
            </div>
          </header>

          <section className="rounded-3xl border border-white/8 bg-[#0f1317] p-3 shadow-[0_20px_70px_rgba(0,0,0,0.28)] md:p-5">
            <div className="mb-4 flex flex-col gap-1">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#f6ca58]">
                Palmarés
              </p>
              <h2 className="text-xl font-black text-white">Copas ganadas por selección</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-[#8d98a7]">
                  <tr className="border-b border-white/8">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Selección</th>
                    <th className="px-3 py-2 text-center">Copas</th>
                    <th className="px-3 py-2">Años campeón</th>
                    <th className="px-3 py-2 text-center">Subcampeonatos</th>
                  </tr>
                </thead>
                <tbody>
                  {model.titleCounts.map((row) => (
                    <tr key={row.canonicalTeamName} className="border-b border-white/7 last:border-b-0">
                      <td className="px-3 py-3 font-black text-white">{row.rank}</td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <TeamLogo
                            src={row.logoUrl}
                            alt={row.teamName}
                            size={24}
                            className="h-6 w-6 object-contain"
                            fallbackClassName="h-5 w-4"
                            unoptimized
                          />
                          <span className="truncate font-black text-white">{row.teamName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-lg font-black text-[#f6ca58]">
                        {row.titles}
                      </td>
                      <td className="px-3 py-3 text-[#c5ced8]">{row.years.join(', ')}</td>
                      <td className="px-3 py-3 text-center font-bold text-[#c5ced8]">
                        {row.runnerUps}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-white/8 bg-[#0f1317] p-3 shadow-[0_20px_70px_rgba(0,0,0,0.28)] md:p-5">
            <div className="mb-4 flex flex-col gap-1">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#63c7ff]">
                Finales
              </p>
              <h2 className="text-xl font-black text-white">Finales y partidos decisivos</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[820px] w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-[#8d98a7]">
                  <tr className="border-b border-white/8">
                    <th className="px-3 py-2">Año</th>
                    <th className="px-3 py-2">Campeón</th>
                    <th className="px-3 py-2">Resultado</th>
                    <th className="px-3 py-2">Subcampeón</th>
                    <th className="px-3 py-2">Sede</th>
                  </tr>
                </thead>
                <tbody>
                  {model.finals.map((final) => (
                    <tr key={final.year} className="border-b border-white/7 last:border-b-0">
                      <td className="px-3 py-3 font-black text-white">{final.year}</td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <TeamLogo
                            src={final.championLogoUrl}
                            alt={final.champion}
                            size={22}
                            className="h-[22px] w-[22px] object-contain"
                            fallbackClassName="h-5 w-4"
                            unoptimized
                          />
                          <span className="truncate font-black text-[#f6ca58]">{final.champion}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-black text-white">
                        {final.displayScore}
                        {final.afterExtraTime || final.decisiveMatch ? (
                          <span className="ml-2 text-xs font-bold text-[#9aa6b2]">
                            {final.decisiveMatch ? 'partido decisivo' : 't.e.'}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <TeamLogo
                            src={final.runnerUpLogoUrl}
                            alt={final.runnerUp}
                            size={20}
                            className="h-5 w-5 object-contain"
                            fallbackClassName="h-4 w-3.5"
                            unoptimized
                          />
                          <span className="truncate font-semibold text-[#dce5ef]">{final.runnerUp}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[#c5ced8]">
                        {[final.venue, final.city, final.country].filter(Boolean).join(' · ') || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
