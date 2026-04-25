import Link from 'next/link'

import { getSectionConfig } from '@/lib/tournament-pages'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function SeccionPage({ params }: PageProps) {
  const { id } = await params
  const section = getSectionConfig(id)

  if (!section) {
    return (
      <div className="min-h-screen bg-[#0a0d0b] px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl rounded-3xl border border-white/8 bg-[#111418] p-6">
          <h1 className="text-2xl font-black">Seccion no encontrada</h1>
          <p className="mt-2 text-[#8d98a7]">No existe esta seccion dentro del proyecto.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="mx-auto max-w-7xl px-3 py-4 md:px-5 md:py-6">
        <main className="min-w-0 space-y-4">
          <header className="rounded-3xl border border-white/8 bg-[#111418]/95 px-4 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7ff0b2]">
              Seccion
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">
              {section.title}
            </h1>
            <p className="mt-2 text-sm text-[#8d98a7]">
              Elegí un torneo para ver tablas, rankings y estadísticas destacadas.
            </p>
          </header>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {section.tournaments.map((tournament) => (
              <Link
                key={tournament.key}
                href={`/liga/${tournament.key}`}
                className="group rounded-3xl border border-white/8 bg-[linear-gradient(180deg,#111418_0%,#0d1115_100%)] p-5 transition hover:border-[#2b5d46] hover:bg-[linear-gradient(180deg,#12171c_0%,#11161b_100%)]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ff0b2]">
                  {section.title}
                </p>
                <h2 className="mt-2 text-lg font-bold text-white">{tournament.title}</h2>
                <p className="mt-3 text-sm text-[#94a0ae]">
                  Ver tabla de posiciones, goleadores, asistencias y tarjetas.
                </p>
                <div className="mt-5 inline-flex rounded-full border border-white/8 px-3 py-1 text-xs font-semibold text-[#cfd7e1] transition group-hover:border-[#2b5d46] group-hover:text-white">
                  Entrar al torneo
                </div>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
