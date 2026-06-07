import Link from 'next/link'
import type { Metadata } from 'next'

import { TeamLogo } from '@/frontend/components/AssetImage'
import ShareCardButton from '@/frontend/components/share/ShareCardButton'
import { buildMatchHistoryViewModel } from '@/server/match-history'
import { formatMatchDateTimeArgentina } from '@/shared/utils/argentina-time'
import { buildSeoMetadata } from '@/shared/seo'

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params

  return buildSeoMetadata({
    title: 'Historial del partido | Hay Fulbo',
    description: 'Historial de enfrentamientos entre selecciones y equipos en Hay Fulbo.',
    path: `/partido/${id}/historial`,
  })
}

function formatHistoryDate(date: string | null) {
  if (!date) return 'Fecha no disponible'

  return formatMatchDateTimeArgentina(date)
}

export default async function MatchHistoryPage({ params }: PageProps) {
  const { id } = await params
  let history: Awaited<ReturnType<typeof buildMatchHistoryViewModel>> | null = null
  let loadError: unknown = null

  try {
    history = await buildMatchHistoryViewModel(id)
  } catch (error) {
    loadError = error
  }

  if (loadError || !history) {
    return (
      <div className="min-h-screen text-white">
        <div className="mx-0 w-full max-w-none px-0 py-3 md:mx-auto md:max-w-6xl md:px-4 md:py-10">
          <div className="w-full rounded-2xl border border-[#5a2a2a] bg-[#3b1919] p-4 md:p-6">
            <h1 className="text-2xl font-black">Historial no disponible</h1>
            <p className="mt-2 text-[#ffd5d5]">
              {loadError instanceof Error
                ? loadError.message
                : 'No se pudo cargar el historial de este partido.'}
            </p>
            <Link
              href={`/partido/${id}`}
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-[#10151a] px-3 py-2 text-sm font-black text-[#dce5ef] transition hover:border-[#7ff0b2]/60 hover:text-white"
            >
              Volver al partido
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const historyShareId = `match-history-card-${id}`
  const historyShareTitle = `${history.homeTeam.name} vs ${history.awayTeam.name} | Historial Hay Fulbo`
  const historyShareText = `Historial: ${history.homeTeam.name} vs ${history.awayTeam.name}`

  return (
    <div className="min-h-screen text-white">
      <div className="w-full max-w-none px-0 py-3 lg:mx-auto lg:max-w-6xl lg:px-5 lg:py-6">
        <header className="hf-hero relative overflow-hidden rounded-3xl">
          <div className="relative z-10 flex flex-col gap-4 px-3 py-4 md:flex-row md:items-center md:justify-between md:px-5 md:py-5">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d5a940]">
                Historial
              </p>
              <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">
                {history.homeTeam.name} vs {history.awayTeam.name}
              </h1>
              <p className="mt-2 text-sm font-semibold text-[#c8d0da]">
                Partidos registrados entre estos equipos, competencia e instancia.
              </p>
            </div>

            <Link
              href={`/partido/${id}`}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#25553d] bg-[#163828] px-3 py-2 text-sm font-black text-[#7ff0b2] transition hover:border-[#7ff0b2]/60 hover:bg-[#1b4a32] sm:px-4"
            >
              Volver al partido
            </Link>
          </div>

          <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-t border-white/6 bg-black/20 px-3 py-3 md:gap-5 md:px-5">
            <div className="flex min-w-0 items-center justify-end gap-2 text-right">
              <span className="truncate text-sm font-black text-white md:text-lg">
                {history.homeTeam.name}
              </span>
              <TeamLogo
                src={history.homeTeam.logoUrl}
                alt={history.homeTeam.name}
                size={34}
                className="h-8 w-8 object-contain"
                fallbackClassName="h-7 w-6"
                unoptimized
              />
            </div>
            <span className="rounded-lg border border-[#d5a940]/40 bg-[#7c5513]/40 px-3 py-1 text-xs font-black text-[#f7d879]">
              vs
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogo
                src={history.awayTeam.logoUrl}
                alt={history.awayTeam.name}
                size={34}
                className="h-8 w-8 object-contain"
                fallbackClassName="h-7 w-6"
                unoptimized
              />
              <span className="truncate text-sm font-black text-white md:text-lg">
                {history.awayTeam.name}
              </span>
            </div>
          </div>
        </header>

        <main className="mt-4 space-y-4">
          {history.warnings.length ? (
            <section className="rounded-2xl border border-[#574b20] bg-[#3f3616] px-4 py-3 text-sm text-[#f3d36c]">
              {history.warnings.join(' ')}
            </section>
          ) : null}

          <section id={historyShareId} className="hf-card overflow-hidden rounded-2xl">
            <div className="hf-section-head flex items-center justify-between gap-3 px-3 py-3 md:px-4">
              <span aria-hidden="true" className="h-10 w-10" />
              <h2 className="text-lg font-black text-white">Enfrentamientos</h2>
              <ShareCardButton
                targetId={historyShareId}
                fileName={`hay-fulbo-historial-${id}.png`}
                title={historyShareTitle}
                text={historyShareText}
                url={`/partido/${id}/historial`}
              />
            </div>

            {history.items.length ? (
              <div className="divide-y divide-white/7">
                {history.items.map((item) => (
                  <article
                    key={`${item.id}-${item.externalId ?? 'local'}`}
                    className="grid gap-3 px-3 py-3 md:grid-cols-[170px_minmax(0,1fr)_220px] md:items-center md:px-4"
                  >
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#9adfb8]">
                        {formatHistoryDate(item.date)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#8d98a7]">
                        {item.status ?? 'Sin estado'}
                      </p>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                      <div className="flex min-w-0 items-center justify-end gap-2 text-right">
                        <span className="truncate text-sm font-black text-white">
                          {item.homeTeam.name}
                        </span>
                        <TeamLogo
                          src={item.homeTeam.logoUrl}
                          alt={item.homeTeam.name}
                          size={22}
                          className="h-[22px] w-[22px] object-contain"
                          fallbackClassName="h-5 w-4"
                          unoptimized
                        />
                      </div>
                      <span className="min-w-[58px] rounded-lg border border-white/8 bg-[#10151a] px-2 py-1 text-center text-sm font-black text-white">
                        {item.scoreLabel}
                      </span>
                      <div className="flex min-w-0 items-center gap-2">
                        <TeamLogo
                          src={item.awayTeam.logoUrl}
                          alt={item.awayTeam.name}
                          size={22}
                          className="h-[22px] w-[22px] object-contain"
                          fallbackClassName="h-5 w-4"
                          unoptimized
                        />
                        <span className="truncate text-sm font-black text-white">
                          {item.awayTeam.name}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/8 bg-[#10151a] px-3 py-2">
                      <p className="text-xs font-black text-white">{item.competition}</p>
                      <p className="mt-1 text-xs font-semibold text-[#9aa6b2]">
                        {item.stage}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-sm text-[#8d98a7]">
                No hay enfrentamientos previos cargados en Supabase para estos equipos.
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
