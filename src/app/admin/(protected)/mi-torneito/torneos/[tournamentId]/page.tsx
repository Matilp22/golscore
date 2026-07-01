import { notFound } from 'next/navigation'
import AdminNotice from '@/components/admin/AdminNotice'
import { MiTorneitoTournamentAdminPanel } from '@/frontend/components/mi-torneito/MiTorneitoAdminForms'
import { getMiTorneitoTournamentBundleById } from '@/server/mi-torneito/repository'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type PageProps = {
  params: Promise<{
    tournamentId: string
  }>
  searchParams: Promise<{
    saved?: string
    error?: string
  }>
}

export default async function AdminMiTorneitoTournamentDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ tournamentId }, query] = await Promise.all([params, searchParams])
  const bundle = await getMiTorneitoTournamentBundleById(tournamentId, true)
  const returnPath = `/admin/mi-torneito/torneos/${tournamentId}`

  if (bundle.error) {
    return (
      <AdminNotice
        title={bundle.error.setupRequired ? 'SQL pendiente' : 'Error'}
        message={bundle.error.message}
        tone="danger"
      />
    )
  }

  if (!bundle.data) notFound()

  return (
    <div className="space-y-4">
      {query.saved ? (
        <AdminNotice title="Cambios guardados" message={`Se guardó: ${query.saved}.`} />
      ) : null}
      {query.error ? (
        <AdminNotice title="No se pudo guardar" message={query.error} tone="danger" />
      ) : null}

      <MiTorneitoTournamentAdminPanel
        bundle={bundle.data}
        returnPath={returnPath}
      />
    </div>
  )
}
