'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/frontend/hooks/useAuth'
import {
  approvePrivateTournamentRequest,
  getPrivateTournamentDetail,
  rejectPrivateTournamentRequest,
} from '@/frontend/services/privateTournamentsService'
import type {
  PrivateTournamentDetail,
  PrivateTournamentRankingRow,
} from '@/frontend/types/private-tournaments'

type PrivateTournamentDetailPageProps = {
  tournamentId: string
}

type RankingMode = 'total' | 'round'

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

function RankingTable({
  rows,
  emptyMessage,
}: {
  rows: PrivateTournamentRankingRow[]
  emptyMessage: string
}) {
  if (!rows.length) {
    return <EmptyState>{emptyMessage}</EmptyState>
  }

  return (
    <div className="overflow-hidden">
      <table className="hf-table w-full table-fixed border-separate border-spacing-0 text-left text-[11px] sm:text-sm">
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
          {rows.map((row) => (
            <tr key={row.userId} className="transition hover:bg-white/[0.025]">
              <td className="px-3 py-2 font-black text-[#7ff0b2]">#{row.position}</td>
              <td className="min-w-0 px-3 py-2 font-bold text-white">{row.username}</td>
              <td className="px-3 py-2 text-right font-black text-[#7ff0b2]">
                {row.points}
              </td>
              <td className="px-3 py-2 text-right text-[#dce7f2]">{row.exactHits}</td>
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
  )
}

function HonorBadge({
  label,
  row,
  variant,
}: {
  label: string
  row: PrivateTournamentRankingRow
  variant: 'gold' | 'silver' | 'fun'
}) {
  const styles = {
    gold: 'border-amber-300/30 bg-amber-300/10 text-amber-200',
    silver: 'border-sky-200/25 bg-sky-300/10 text-sky-100',
    fun: 'border-fuchsia-300/25 bg-fuchsia-300/10 text-fuchsia-100',
  }

  return (
    <div className={`rounded-2xl border p-3 shadow-[0_10px_26px_rgba(0,0,0,0.14)] ${styles[variant]}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.04em]">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-white">{row.username}</p>
      <p className="mt-0.5 text-xs opacity-85">
        {row.points} pts · {row.exactHits} exactos · {row.partialHits} parciales
      </p>
    </div>
  )
}

export default function PrivateTournamentDetailPage({
  tournamentId,
}: PrivateTournamentDetailPageProps) {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [tournament, setTournament] = useState<PrivateTournamentDetail | null>(null)
  const [mode, setMode] = useState<RankingMode>('total')
  const [selectedRound, setSelectedRound] = useState('')
  const [selectedHonorRound, setSelectedHonorRound] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedRoundRanking = useMemo(() => {
    return (
      tournament?.roundRankings.find((round) => round.value === selectedRound) ??
      tournament?.roundRankings[0] ??
      null
    )
  }, [selectedRound, tournament])

  const selectedHonorRoundRanking = useMemo(() => {
    return (
      tournament?.roundRankings.find((round) => round.value === selectedHonorRound) ??
      tournament?.roundRankings[0] ??
      null
    )
  }, [selectedHonorRound, tournament])

  const activeRows = mode === 'total'
    ? tournament?.ranking ?? []
    : selectedRoundRanking?.ranking ?? []

  const honorRows = useMemo(() => {
    const rows = (selectedHonorRoundRanking?.ranking ?? []).filter(
      (row) => row.playedPredictions > 0
    )

    return {
      first: rows[0] ?? null,
      second: rows[1] ?? null,
      last: rows.length > 2 ? rows[rows.length - 1] : null,
    }
  }, [selectedHonorRoundRanking])

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
      setSelectedRound((current) =>
        current && data.roundRankings.some((round) => round.value === current)
          ? current
          : data.roundRankings[0]?.value ?? ''
      )
      setSelectedHonorRound((current) =>
        current && data.roundRankings.some((round) => round.value === current)
          ? current
          : data.roundRankings[0]?.value ?? ''
      )
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
      setSelectedRound((current) =>
        current && nextTournament.roundRankings.some((round) => round.value === current)
          ? current
          : nextTournament.roundRankings[0]?.value ?? ''
      )
      setSelectedHonorRound((current) =>
        current && nextTournament.roundRankings.some((round) => round.value === current)
          ? current
          : nextTournament.roundRankings[0]?.value ?? ''
      )
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
      <section className="hf-card rounded-2xl p-4 text-sm text-[#9aa7b5]">
        Cargando torneo...
      </section>
    )
  }

  if (!user) {
    return (
      <section className="hf-card rounded-2xl p-4">
        <h2 className="text-lg font-black text-white">Torneo privado</h2>
        <p className="mt-2 text-sm text-[#9aa7b5]">
          Iniciá sesión para ver este torneo privado.
        </p>
      </section>
    )
  }

  if (error && !tournament) {
    return (
      <section className="hf-card rounded-2xl p-4">
        <h2 className="text-lg font-black text-white">Torneo privado</h2>
        <p className="mt-2 text-sm text-red-200">{error}</p>
        <Link
          href="/prode/torneos"
          className="hf-button-secondary mt-4 inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-black"
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
      <section className="hf-hero overflow-hidden rounded-3xl p-3 sm:p-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-black text-white sm:text-3xl">
              {tournament.displayName}
            </h1>
            <p className="mt-2 text-sm text-[#9aa7b5]">
              {tournament.memberCount} participantes
            </p>
          </div>
          <Link
            href="/prode/torneos"
            className="hf-button-secondary inline-flex h-10 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-black"
          >
            Volver
          </Link>
        </div>
      </section>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-4">
        <section className="hf-card min-w-0 overflow-hidden rounded-2xl">
          <div className="hf-section-head px-3 py-3 sm:px-4">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-black text-white">Tabla del torneo</h2>
                <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-white/8 bg-black/25 p-1 sm:w-56">
                  {[
                    { key: 'total', label: 'Total' },
                    { key: 'round', label: 'Por fecha' },
                  ].map((tab) => {
                    const isActive = mode === tab.key

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setMode(tab.key as RankingMode)}
                        className={`h-9 rounded-lg text-sm font-bold transition ${
                          isActive
                            ? 'bg-[#70ff9d]/15 text-[#70ff9d]'
                            : 'text-[#9aa7b5] hover:bg-white/[0.04] hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {mode === 'round' ? (
                <select
                  value={selectedRoundRanking?.value ?? ''}
                  onChange={(event) => {
                    setSelectedRound(event.target.value)
                    setSelectedHonorRound(event.target.value)
                  }}
                  disabled={!tournament.roundRankings.length}
                  className="hf-input h-10 w-full rounded-xl px-3 text-sm font-semibold outline-none transition disabled:cursor-not-allowed disabled:text-[#8d98a7]"
                >
                  {tournament.roundRankings.length ? (
                    tournament.roundRankings.map((round) => (
                      <option key={round.value} value={round.value}>
                        {round.label}
                      </option>
                    ))
                  ) : (
                    <option value="">Sin fecha disponible</option>
                  )}
                </select>
              ) : null}
            </div>
          </div>

          <RankingTable
            rows={activeRows}
            emptyMessage={
              mode === 'total'
                ? 'Todavía no hay puntos computados.'
                : 'Todavía no hay puntos para esta fecha.'
            }
          />
        </section>

        <aside className="min-w-0 space-y-3">
          <section className="hf-card overflow-hidden rounded-2xl">
            <div className="hf-section-head px-3 py-3 sm:px-4">
              <h2 className="text-lg font-black text-white">Menciones honoríficas</h2>
              {selectedHonorRoundRanking ? (
                <p className="mt-1 text-xs font-semibold text-[#8d98a7]">
                  {selectedHonorRoundRanking.label}
                </p>
              ) : null}
            </div>
            <div className="space-y-2 p-3">
              <select
                value={selectedHonorRoundRanking?.value ?? ''}
                onChange={(event) => setSelectedHonorRound(event.target.value)}
                disabled={!tournament.roundRankings.length}
                className="hf-input h-10 w-full rounded-xl px-3 text-sm font-semibold outline-none transition disabled:cursor-not-allowed disabled:text-[#8d98a7]"
              >
                {tournament.roundRankings.length ? (
                  tournament.roundRankings.map((round) => (
                    <option key={round.value} value={round.value}>
                      {round.label}
                    </option>
                  ))
                ) : (
                  <option value="">Sin fecha disponible</option>
                )}
              </select>
              {honorRows.first ? (
                <HonorBadge label="El Pichichi" row={honorRows.first} variant="gold" />
              ) : (
                <EmptyState>Todavía no hay puntos computados en esta fecha.</EmptyState>
              )}
              {honorRows.second ? (
                <HonorBadge label="Casi casi" row={honorRows.second} variant="silver" />
              ) : null}
              {honorRows.last ? (
                <HonorBadge label="Troncazo" row={honorRows.last} variant="fun" />
              ) : null}
            </div>
          </section>

          {isOwner ? (
            <section className="hf-card overflow-hidden rounded-2xl">
              <div className="hf-section-head px-3 py-3 sm:px-4">
                <h2 className="text-lg font-black text-white">Solicitudes de ingreso</h2>
              </div>
              {tournament.pendingRequests.length ? (
                <div className="divide-y divide-white/6">
                  {tournament.pendingRequests.map((request) => (
                    <div key={request.id} className="p-3">
                      <p className="font-bold text-white">{request.username}</p>
                      {request.email ? (
                        <p className="mt-0.5 break-words text-xs text-[#9aa7b5]">
                          {request.email}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-[#8d98a7]">
                        Solicitó acceso: {formatDate(request.requestedAt)}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => reviewRequest(request.id, 'approve')}
                          disabled={reviewingRequestId === request.id}
                          className="hf-button h-9 rounded-xl px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Aceptar
                        </button>
                        <button
                          type="button"
                          onClick={() => reviewRequest(request.id, 'reject')}
                          disabled={reviewingRequestId === request.id}
                          className="hf-button-secondary h-9 rounded-xl px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60"
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

          <section className="hf-card overflow-hidden rounded-2xl">
            <div className="hf-section-head px-3 py-3 sm:px-4">
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
