import AdminCard from '@/components/admin/AdminCard'
import AdminNotice from '@/components/admin/AdminNotice'
import { MiTorneitoRequestsTable } from '@/frontend/components/mi-torneito/MiTorneitoAdminForms'
import { listMiTorneitoRequests } from '@/server/mi-torneito/repository'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type PageProps = {
  searchParams: Promise<{
    q?: string
    saved?: string
    error?: string
  }>
}

export default async function AdminMiTorneitoRequestsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const requests = await listMiTorneitoRequests(params.q ?? '')
  const returnPath = `/admin/mi-torneito/solicitudes${params.q ? `?q=${encodeURIComponent(params.q)}` : ''}`

  return (
    <div className="space-y-4">
      {params.saved ? (
        <AdminNotice title="Cambios guardados" message="La solicitud fue actualizada." />
      ) : null}
      {params.error ? (
        <AdminNotice title="No se pudo guardar" message={params.error} tone="danger" />
      ) : null}
      {requests.error ? (
        <AdminNotice
          title={requests.error.setupRequired ? 'SQL pendiente' : 'Error'}
          message={requests.error.message}
          tone="danger"
        />
      ) : null}

      <AdminCard
        title="Solicitudes de Mi Torneito"
        description="Revisá pedidos públicos, contactá organizadores y cambiá estado."
      >
        <form action="/admin/mi-torneito/solicitudes" className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Buscar por torneo, email, ciudad o estado"
            className="hf-input h-11 flex-1 rounded-xl px-3 text-sm"
          />
          <button className="hf-button h-11 rounded-xl px-4 text-sm font-black" type="submit">
            Buscar
          </button>
        </form>
        <MiTorneitoRequestsTable requests={requests.data} returnPath={returnPath} />
      </AdminCard>
    </div>
  )
}
