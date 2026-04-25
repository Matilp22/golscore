import ProdePanel from '@/frontend/components/prode/ProdePanel'

export default function ProdePage() {
  return (
    <div className="min-h-screen overflow-x-hidden text-white">
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 md:py-6">
        <div className="mb-4 rounded-2xl border border-white/8 bg-[#111418] p-4 sm:p-5">
          <h1 className="text-2xl font-black sm:text-3xl">Prode</h1>
          <p className="mt-2 text-sm text-[#8d98a7]">
            Predicciones, bloqueo automático y ranking conectado a Supabase.
          </p>
        </div>

        <ProdePanel />
      </div>
    </div>
  )
}
