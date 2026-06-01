import Link from 'next/link'

import { getSectionConfig } from '@/lib/tournament-pages'
import { buildSeoMetadata } from '@/shared/seo'

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const section = getSectionConfig(id)

  if (!section) {
    return buildSeoMetadata({
      title: 'Sección no encontrada | Hay Fulbo',
      description: 'La sección solicitada no está disponible en Hay Fulbo.',
      path: `/seccion/${id}`,
      noIndex: true,
    })
  }

  return buildSeoMetadata({
    title: `${section.title} | Ligas, Tablas y Estadísticas | Hay Fulbo`,
    description: `Explorá ligas de ${section.title} con fixtures, tablas de posiciones, goleadores, asistencias y estadísticas en Hay Fulbo.`,
    path: `/seccion/${id}`,
  })
}

export default async function SeccionPage({ params }: PageProps) {
  const { id } = await params
  const section = getSectionConfig(id)

  if (!section) {
    return (
      <div className="min-h-screen bg-[#0a0d0b] px-2 py-3 text-white md:px-4 md:py-10">
        <div className="hf-card w-full max-w-none rounded-3xl p-4 md:mx-auto md:max-w-6xl md:p-6">
          <h1 className="text-2xl font-black">Seccion no encontrada</h1>
          <p className="mt-2 text-[#8d98a7]">No existe esta seccion dentro del proyecto.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="w-full max-w-none px-0 py-3 lg:mx-auto lg:max-w-7xl lg:px-5 lg:py-6">
        <main className="min-w-0 space-y-4">
          <header className="hf-hero w-full overflow-hidden rounded-3xl px-3 py-5 md:px-4">
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
                className="hf-card hf-card-hover group w-full rounded-3xl p-4 md:p-5"
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
