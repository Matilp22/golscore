import ProdePanel from '@/frontend/components/prode/ProdePanel'

export default function ProdePage() {
  return (
    <div className="min-h-screen overflow-x-hidden text-white">
      <div className="w-full px-2 py-3 md:mx-auto md:max-w-6xl md:px-4 md:py-6">
        <div className="mb-4 w-full rounded-2xl border border-white/8 bg-[#111418] p-2 sm:p-3 md:p-4">
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
