'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/frontend/hooks/useAuth'
import {
  createPrivateTournament,
  getPrivateTournaments,
  requestPrivateTournamentAccess,
  searchPrivateTournament,
} from '@/frontend/services/privateTournamentsService'
import type {
  JoinRequestStatus,
  PrivateTournamentSearchResult,
  PrivateTournamentSummary,
} from '@/frontend/types/private-tournaments'

function getRequestLabel(status: JoinRequestStatus | null) {
  if (status === 'pending') return 'Solicitud pendiente'
  if (status === 'approved') return 'Solicitud aprobada'
  if (status === 'rejected') return 'Solicitud rechazada'
  if (status === 'cancelled') return 'Solicitud cancelada'
  return null
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-5 text-sm text-[#9aa7b5]">
      {children}
    </div>
  )
}

const PRODE_TOURNAMENT_OPTIONS = [
  { externalId: '128', name: 'Liga Profesional Argentina' },
  { externalId: '129', name: 'Primera Nacional' },
  { externalId: '1', name: 'Mundial' },
]

export default function PrivateTournamentsPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [tournaments, setTournaments] = useState<PrivateTournamentSummary[]>([])
  const [createName, setCreateName] = useState('')
  const [createLeagueExternalId, setCreateLeagueExternalId] = useState(
    PRODE_TOURNAMENT_OPTIONS[0].externalId
  )
  const [searchName, setSearchName] = useState('')
  const [searchResult, setSearchResult] = useState<PrivateTournamentSearchResult | null>(null)
  const [searchDone, setSearchDone] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)

  const loadTournaments = useCallback(async () => {
    if (!user) {
      setTournaments([])
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const data = await getPrivateTournaments()
      setTournaments(data)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudieron cargar tus torneos.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (isAuthLoading) return

    void loadTournaments()
  }, [isAuthLoading, loadTournaments])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    setError('')
    setIsCreating(true)

    try {
      await createPrivateTournament({
        baseName: createName,
        leagueExternalId: createLeagueExternalId,
      })
      setCreateName('')
      setMessage('Torneo creado. Ya participás automáticamente.')
      await loadTournaments()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'No se pudo crear el torneo.'
      )
    } finally {
      setIsCreating(false)
    }
  }

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    setError('')
    setSearchDone(false)
    setSearchResult(null)
    setIsSearching(true)

    try {
      const result = await searchPrivateTournament(searchName)
      setSearchResult(result)
      setSearchDone(true)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'No se pudo buscar el torneo.'
      )
    } finally {
      setIsSearching(false)
    }
  }

  const handleRequestAccess = async () => {
    if (!searchResult) return

    setMessage('')
    setError('')
    setIsRequesting(true)

    try {
      await requestPrivateTournamentAccess(searchResult.id)
      setSearchResult({
        ...searchResult,
        requestStatus: 'pending',
        canRequest: false,
      })
      setMessage('Solicitud enviada. El administrador debe aprobar tu ingreso.')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo solicitar acceso.'
      )
    } finally {
      setIsRequesting(false)
    }
  }

  if (isAuthLoading) {
    return (
      <section className="rounded-2xl border border-white/8 bg-[#10151a]/95 p-4 text-sm text-[#9aa7b5]">
        Cargando sesión...
      </section>
    )
  }

  if (!user) {
    return (
      <section className="rounded-2xl border border-white/8 bg-[#10151a]/95 p-4">
        <h2 className="text-lg font-black text-white">Torneos privados</h2>
        <p className="mt-2 text-sm text-[#9aa7b5]">
          Iniciá sesión para crear torneos, solicitar acceso y ver rankings privados.
        </p>
      </section>
    )
  }

  return (
    <div className="grid w-full min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-4">
      <section className="min-w-0 rounded-2xl border border-white/8 bg-[#10151a]/95 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
        <div className="border-b border-white/7 px-3 py-3 sm:px-4">
          <h2 className="text-lg font-black text-white">Torneos en los que participo</h2>
        </div>
        <div className="space-y-3 p-3 sm:p-4">
          {isLoading ? (
            <EmptyState>Cargando torneos...</EmptyState>
          ) : tournaments.length ? (
            tournaments.map((tournament) => (
              <Link
                key={tournament.id}
                href={`/prode/torneos/${tournament.id}`}
                className="block rounded-2xl border border-white/8 bg-white/[0.025] p-3 transition hover:border-[#7ff0b2]/30 hover:bg-white/[0.04]"
              >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words text-base font-black text-white">
                      {tournament.displayName}
                    </h3>
                    <p className="mt-1 text-sm text-[#9aa7b5]">
                      {tournament.memberCount} participantes
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#dce7f2]">
                      {tournament.myPosition
                        ? `Mi posición: #${tournament.myPosition}`
                        : 'Mi posición: sin puntos todavía'}{' '}
                      · {tournament.myPoints} pts
                    </p>
                  </div>
                  <span className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#163828] px-4 text-sm font-black text-[#7ff0b2] transition">
                    Ver torneo
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <EmptyState>Todavía no participás en ningún torneo privado.</EmptyState>
          )}
        </div>
      </section>

      <aside className="min-w-0 space-y-3">
        <section className="rounded-2xl border border-white/8 bg-[#10151a]/95 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
          <div className="border-b border-white/7 px-3 py-3 sm:px-4">
            <h2 className="text-lg font-black text-white">Crear torneo</h2>
          </div>
          <form onSubmit={handleCreate} className="space-y-3 p-3 sm:p-4">
            <input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="Nombre del torneo"
              className="h-11 w-full rounded-xl border border-white/8 bg-[#0d1217] px-3 text-sm font-semibold text-white outline-none transition placeholder:text-[#657384] focus:border-[#7ff0b2]"
            />
            <select
              value={createLeagueExternalId}
              onChange={(event) => setCreateLeagueExternalId(event.target.value)}
              className="h-11 w-full rounded-xl border border-white/8 bg-[#0d1217] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#7ff0b2]"
            >
              {PRODE_TOURNAMENT_OPTIONS.map((option) => (
                <option key={option.externalId} value={option.externalId}>
                  {option.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isCreating}
              className="h-11 w-full rounded-xl bg-[#1fa463] px-4 text-sm font-black text-[#07110b] transition hover:bg-[#32c97c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? 'Creando...' : 'Crear torneo'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/8 bg-[#10151a]/95 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
          <div className="border-b border-white/7 px-3 py-3 sm:px-4">
            <h2 className="text-lg font-black text-white">Buscar torneo</h2>
          </div>
          <form onSubmit={handleSearch} className="space-y-3 p-3 sm:p-4">
            <input
              value={searchName}
              onChange={(event) => setSearchName(event.target.value)}
              placeholder="Nombre exacto del torneo"
              className="h-11 w-full rounded-xl border border-white/8 bg-[#0d1217] px-3 text-sm font-semibold text-white outline-none transition placeholder:text-[#657384] focus:border-[#7ff0b2]"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="h-11 w-full rounded-xl bg-[#163828] px-4 text-sm font-black text-[#7ff0b2] transition hover:bg-[#1d4733] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSearching ? 'Buscando...' : 'Buscar'}
            </button>
          </form>
          <div className="px-3 pb-3 sm:px-4 sm:pb-4">
            {searchDone && !searchResult ? (
              <EmptyState>No se encontró un torneo con ese nombre.</EmptyState>
            ) : null}

            {searchResult ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
                <h3 className="break-words text-base font-black text-white">
                  {searchResult.displayName}
                </h3>
                <p className="mt-1 text-sm text-[#9aa7b5]">
                  {searchResult.leagueName} · {searchResult.memberCount} participantes
                </p>
                <p className="mt-2 text-sm font-semibold text-[#dce7f2]">
                  {searchResult.isMember
                    ? 'Ya participás en este torneo.'
                    : getRequestLabel(searchResult.requestStatus) ??
                      'Podés solicitar acceso.'}
                </p>
                {searchResult.canRequest ? (
                  <button
                    type="button"
                    onClick={handleRequestAccess}
                    disabled={isRequesting}
                    className="mt-3 h-10 w-full rounded-xl bg-[#1fa463] px-4 text-sm font-black text-[#07110b] transition hover:bg-[#32c97c] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRequesting
                      ? 'Enviando...'
                      : searchResult.requestStatus === 'rejected'
                        ? 'Volver a solicitar'
                        : 'Solicitar acceso'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

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
      </aside>
    </div>
  )
}
