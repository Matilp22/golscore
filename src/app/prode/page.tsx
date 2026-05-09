import Link from 'next/link'
import ProdePanel from '@/frontend/components/prode/ProdePanel'

export default function ProdePage() {
  return (
    <div className="min-h-screen overflow-x-hidden text-white">
      <div className="w-full px-2 py-3 md:mx-auto md:max-w-6xl md:px-4 md:py-6">
        <div className="mb-3 w-full rounded-2xl border border-white/8 bg-[#10151a]/95 px-3 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.16)] sm:px-4 md:mb-4 md:px-5 md:py-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-black sm:text-3xl">Prode</h1>
              <p className="mt-1 text-sm text-[#9aa7b5]">
                Pronosticá, sumá puntos y metete en el ranking.
              </p>
            </div>
            <Link
              href="/prode/torneos"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#1fa463] px-4 text-sm font-black text-[#07110b] shadow-[0_8px_18px_rgba(31,164,99,0.22)] transition hover:bg-[#32c97c] sm:px-5"
            >
              Torneos
            </Link>
          </div>
        </div>

        <ProdePanel />
      </div>
    </div>
  )
}
