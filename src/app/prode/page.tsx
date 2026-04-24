import ProdePanel from '@/frontend/components/prode/ProdePanel'

export default function ProdePage() {
  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 rounded-2xl border border-white/8 bg-[#111418] p-5">
          <h1 className="text-2xl font-black">Prode</h1>
          <p className="mt-2 text-sm text-[#8d98a7]">
            Predicciones, bloqueo automatico y ranking conectado a Supabase.
          </p>
        </div>

        <ProdePanel />
      </div>
    </div>
  )
}
