import Link from 'next/link'
import PrivateTournamentsPage from '@/frontend/components/prode/private-tournaments/PrivateTournamentsPage'

export default function ProdeTournamentsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden text-white">
      <div className="w-full px-2 py-3 md:mx-auto md:max-w-6xl md:px-4 md:py-6">
        <div className="mb-3 w-full rounded-2xl border border-white/8 bg-[#10151a]/95 px-3 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.16)] sm:px-4 md:mb-4 md:px-5 md:py-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-black sm:text-3xl">Torneos privados</h1>
              <p className="mt-1 text-sm text-[#9aa7b5]">
                Competí con amigos usando tus predicciones del Prode general.
              </p>
            </div>
            <Link
              href="/prode"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] px-4 text-sm font-black text-[#dce7f2] transition hover:bg-white/[0.06]"
            >
              Volver al Prode
            </Link>
          </div>
        </div>

        <PrivateTournamentsPage />
      </div>
    </div>
  )
}
