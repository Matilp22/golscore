'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/frontend/hooks/useAuth'
import {
  approvePrivateTournamentRequest,
  getPrivateTournamentDetail,
  rejectPrivateTournamentRequest,
} from '@/frontend/services/privateTournamentsService'
import type { PrivateTournamentDetail } from '@/frontend/types/private-tournaments'

type PrivateTournamentDetailPageProps = {
  tournamentId: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function EmptyState({ children }: { children: string }) {
  return <p className="p-4 text-sm text-[#9aa7b5]">{children}</p>
}

export default function PrivateTournamentDetailPage({
  tournamentId,
}: PrivateTournamentDetailPageProps) {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [tournament, setTournament] = useState<PrivateTournamentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadTournament = useCallback(async () => {
    if (!user) {
      setTournament(null)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const data = await getPrivateTournamentDetail(tournamentId)
      setTournament(data)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'No se pudo cargar el torneo.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [tournamentId, user])

  useEffect(() => {
    if (isAuthLoading) return

    void loadTournament()
  }, [isAuthLoading, loadTournament])

  const reviewRequest = async (requestId: string, action: 'approve' | 'reject') => {
    setMessage('')
    setError('')
    setReviewingRequestId(requestId)

    try {
      const nextTournament =
        action === 'approve'
          ? await approvePrivateTournamentRequest(tournamentId, requestId)
          : await rejectPrivateTournamentRequest(tournamentId, requestId)

      setTournament(nextTournament)
      setMessage(action === 'approve' ? 'Solicitud aprobada.' : 'Solicitud rechazada.')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo revisar la solicitud.'
      )
    } finally {
      setReviewingRequestId(null)
    }
  }

  if (isAuthLoading || isLoading) {
    return (
      <section className="rounded-2xl border border-white/8 bg-[#10151a]/95 p-4 text-sm text-[#9aa7b5]">
        Cargando torneo...
      </section>
    )
  }

  if (!user) {
    return (
      <section className="rounded-2xl border border-white/8 bg-[#10151a]/95 p-4">
        <h2 className="text-lg font-black text-white">Torneo privado</h2>
        <p className="mt-2 text-sm text-[#9aa7b5]">
          Iniciá sesión para ver este torneo privado.
        </p>
      </section>
    )
  }

  if (error && !tournament) {
    return (
      <section className="rounded-2xl border border-white/8 bg-[#10151a]/95 p-4">
        <h2 className="text-lg font-black text-white">Torneo privado</h2>
        <p className="mt-2 text-sm text-red-200">{error}</p>
        <Link
          href="/prode/torneos"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[#163828] px-4 text-sm font-black text-[#7ff0b2]"
        >
          Volver a torneos
        </Link>
      </section>
    )
  }

  if (!tournament) return null

  const isOwner = tournament.currentUserRole === 'owner'

  return (
    <div className="space-y-3 md:space-y-4">
      <section className="rounded-2xl border border-white/8 bg-[#10151a]/95 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.16)] sm:p-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-2xl font-black text-white sm:text-3xl">
                {tournament.name}
              </h1>
              <span className="rounded-full border border-[#7ff0b2]/20 bg-[#163828] px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.02em] text-[#7ff0b2]">
                {isOwner ? 'Owner' : 'Miembro'}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#9aa7b5]">
              Creador: {tournament.creatorName} · {tournament.memberCount} participantes
            </p>
          </div>
          <Link
            href="/prode/torneos"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] px-4 text-sm font-black text-[#dce7f2] transition hover:bg-white/[0.06]"
          >
            Volver
          </Link>
        </div>
      </section>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-4">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/8 bg-[#10151a]/95 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
          <div className="border-b border-white/7 px-3 py-3 sm:px-4">
            <h2 className="text-lg font-black text-white">Ranking privado</h2>
          </div>
          {tournament.ranking.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left text-sm">
                <thead className="text-xs uppercase text-[#8d98a7]">
                  <tr>
                    <th className="px-3 py-2 font-black">Pos.</th>
                    <th className="px-3 py-2 font-black">Usuario</th>
                    <th className="px-3 py-2 text-right font-black">Pts</th>
                    <th className="px-3 py-2 text-right font-black">Exactos</th>
                    <th className="px-3 py-2 text-right font-black">Parciales</th>
                    <th className="px-3 py-2 text-right font-black">PJ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {tournament.ranking.map((row) => (
                    <tr key={row.userId} className="transition hover:bg-white/[0.025]">
                      <td className="px-3 py-2 font-black text-[#7ff0b2]">
                        #{row.position}
                      </td>
                      <td className="min-w-0 px-3 py-2 font-bold text-white">
                        {row.username}
                      </td>
                      <td className="px-3 py-2 text-right font-black text-[#7ff0b2]">
                        {row.points}
                      </td>
                      <td className="px-3 py-2 text-right text-[#dce7f2]">
                        {row.exactHits}
                      </td>
                      <td className="px-3 py-2 text-right text-[#dce7f2]">
                        {row.partialHits}
                      </td>
                      <td className="px-3 py-2 text-right text-[#9aa7b5]">
                        {row.playedPredictions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>Todavía no hay puntos calculados entre los miembros.</EmptyState>
          )}
        </section>

        <aside className="min-w-0 space-y-3">
          {isOwner ? (
            <section className="overflow-hidden rounded-2xl border border-white/8 bg-[#10151a]/95 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
              <div className="border-b border-white/7 px-3 py-3 sm:px-4">
                <h2 className="text-lg font-black text-white">Solicitudes pendientes</h2>
              </div>
              {tournament.pendingRequests.length ? (
                <div className="divide-y divide-white/6">
                  {tournament.pendingRequests.map((request) => (
                    <div key={request.id} className="p-3">
                      <p className="font-bold text-white">{request.username}</p>
                      <p className="mt-1 text-xs text-[#8d98a7]">
                        Solicitó acceso: {formatDate(request.requestedAt)}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => reviewRequest(request.id, 'approve')}
                          disabled={reviewingRequestId === request.id}
                          className="h-9 rounded-xl bg-[#1fa463] px-3 text-xs font-black text-[#07110b] transition hover:bg-[#32c97c] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Aceptar
                        </button>
                        <button
                          type="button"
                          onClick={() => reviewRequest(request.id, 'reject')}
                          disabled={reviewingRequestId === request.id}
                          className="h-9 rounded-xl border border-white/8 bg-white/[0.03] px-3 text-xs font-black text-[#dce7f2] transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>No hay solicitudes pendientes.</EmptyState>
              )}
            </section>
          ) : null}

          <section className="overflow-hidden rounded-2xl border border-white/8 bg-[#10151a]/95 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
            <div className="border-b border-white/7 px-3 py-3 sm:px-4">
              <h2 className="text-lg font-black text-white">Miembros</h2>
            </div>
            <div className="divide-y divide-white/6">
              {tournament.members.map((member) => (
                <div
                  key={member.id}
                  className="flex min-w-0 items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-white">
                      {member.username}
                    </p>
                    <p className="mt-0.5 text-xs text-[#8d98a7]">
                      Desde {formatDate(member.joinedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[11px] font-black uppercase text-[#9aa7b5]">
                    {member.role === 'owner' ? 'Owner' : 'Miembro'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {message ? (
        <div className="rounded-2xl border border-[#7ff0b2]/20 bg-[#10241a] px-3 py-3 text-sm font-semibold text-[#7ff0b2]">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-3 text-sm font-semibold text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  )
}
