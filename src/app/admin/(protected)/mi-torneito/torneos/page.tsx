import Link from 'next/link'
import AdminCard from '@/components/admin/AdminCard'
import AdminNotice from '@/components/admin/AdminNotice'
import { MiTorneitoCreateTournamentForm } from '@/frontend/components/mi-torneito/MiTorneitoAdminForms'
import { listAllMiTorneitoTournaments, listMiTorneitoRequests } from '@/server/mi-torneito/repository'
import { MI_TORNEITO_STATUS_LABELS } from '@/shared/mi-torneito/types'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type PageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function AdminMiTorneitoTournamentsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const [tournaments, requests] = await Promise.all([
    listAllMiTorneitoTournaments(),
    listMiTorneitoRequests(),
  ])
  const error = params.error || tournaments.error?.message || requests.error?.message

  return (
    <div className="space-y-4">
      {error ? (
        <AdminNotice
          title={tournaments.error?.setupRequired || requests.error?.setupRequired ? 'SQL pendiente' : 'Error'}
          message={error}
          tone="danger"
        />
      ) : null}

      <MiTorneitoCreateTournamentForm requests={requests.data} />

      <AdminCard title="Torneos creados" description="Entrá al detalle para cargar equipos, rondas, fixture y admins.">
        {tournaments.data.length ? (
          <div className="grid gap-3">
            {tournaments.data.map((tournament) => (
              <Link
                key={tournament.id}
                href={`/admin/mi-torneito/torneos/${tournament.id}`}
                className="rounded-xl border border-white/8 bg-black/10 p-3 transition hover:border-[#70ff9d]/30"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{tournament.name}</p>
                    <p className="mt-1 text-xs text-[#9aa7b5]">
                      {tournament.city ?? 'Sin ciudad'} · {tournament.format ?? 'Sin formato'}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#70ff9d]/20 bg-[#70ff9d]/10 px-3 py-1 text-xs font-black text-[#b8ffd0]">
                    {MI_TORNEITO_STATUS_LABELS[tournament.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#9aa7b5]">No hay torneos creados.</p>
        )}
      </AdminCard>
    </div>
  )
}
