import Link from 'next/link'
import AdminCard from '@/components/admin/AdminCard'
import AdminNotice from '@/components/admin/AdminNotice'
import { getMiTorneitoAdminSummary, listMiTorneitoRequests, listAllMiTorneitoTournaments } from '@/server/mi-torneito/repository'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AdminMiTorneitoPage() {
  const [summary, requests, tournaments] = await Promise.all([
    getMiTorneitoAdminSummary(),
    listMiTorneitoRequests(),
    listAllMiTorneitoTournaments(),
  ])

  const error = summary.error || requests.error || tournaments.error

  return (
    <div className="space-y-4">
      {error ? (
        <AdminNotice
          title={error.setupRequired ? 'SQL pendiente' : 'Error de Mi Torneito'}
          message={error.message}
          tone="danger"
        />
      ) : null}

      <AdminCard
        title="Mi Torneito"
        description="Producto concierge para torneos amateur: solicitudes, torneos, equipos, fixture y resultados."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/8 bg-black/10 p-3">
            <p className="text-sm text-[#9aa7b5]">Solicitudes pendientes</p>
            <strong className="mt-1 block text-3xl text-white">{summary.data.pendingRequests}</strong>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/10 p-3">
            <p className="text-sm text-[#9aa7b5]">Torneos activos</p>
            <strong className="mt-1 block text-3xl text-white">{summary.data.activeTournaments}</strong>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/10 p-3">
            <p className="text-sm text-[#9aa7b5]">Equipos cargados</p>
            <strong className="mt-1 block text-3xl text-white">{summary.data.totalTeams}</strong>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/10 p-3">
            <p className="text-sm text-[#9aa7b5]">Partidos programados</p>
            <strong className="mt-1 block text-3xl text-white">{summary.data.upcomingMatches}</strong>
          </div>
        </div>
      </AdminCard>

      <AdminCard title="Accesos rápidos">
        <div className="grid gap-2 sm:grid-cols-3">
          <Link href="/admin/mi-torneito/solicitudes" className="hf-button-secondary rounded-xl px-3 py-2 text-sm font-black">
            Solicitudes
          </Link>
          <Link href="/admin/mi-torneito/torneos" className="hf-button-secondary rounded-xl px-3 py-2 text-sm font-black">
            Torneos
          </Link>
          <Link href="/mi-torneito" className="hf-button-secondary rounded-xl px-3 py-2 text-sm font-black">
            Landing pública
          </Link>
        </div>
      </AdminCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminCard title="Últimas solicitudes">
          {requests.data.length ? (
            <div className="space-y-2">
              {requests.data.slice(0, 5).map((request) => (
                <div key={request.id} className="rounded-xl border border-white/8 bg-black/10 px-3 py-2 text-sm">
                  <p className="font-black text-white">{request.tournamentName}</p>
                  <p className="mt-1 text-[#9aa7b5]">{request.organizerEmail} · {request.status}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#9aa7b5]">No hay solicitudes todavía.</p>
          )}
        </AdminCard>

        <AdminCard title="Torneos recientes">
          {tournaments.data.length ? (
            <div className="space-y-2">
              {tournaments.data.slice(0, 5).map((tournament) => (
                <Link
                  key={tournament.id}
                  href={`/admin/mi-torneito/torneos/${tournament.id}`}
                  className="block rounded-xl border border-white/8 bg-black/10 px-3 py-2 text-sm transition hover:border-[#70ff9d]/30"
                >
                  <p className="font-black text-white">{tournament.name}</p>
                  <p className="mt-1 text-[#9aa7b5]">{tournament.status} · {tournament.city ?? 'Sin ciudad'}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#9aa7b5]">No hay torneos creados.</p>
          )}
        </AdminCard>
      </div>
    </div>
  )
}
