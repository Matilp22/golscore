'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { useAuth } from '@/frontend/hooks/useAuth'
import {
  acceptPrivateTournamentInvite,
  getPrivateTournamentInvite,
} from '@/frontend/services/privateTournamentsService'
import type { PrivateTournamentInviteInfo } from '@/frontend/types/private-tournaments'

type PrivateTournamentInvitePageProps = {
  token: string
}

export default function PrivateTournamentInvitePage({
  token,
}: PrivateTournamentInvitePageProps) {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [data, setData] = useState<PrivateTournamentInviteInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadInvite() {
      setIsLoading(true)
      setError('')

      try {
        const invite = await getPrivateTournamentInvite(token)
        if (isMounted) setData(invite)
      } catch (caughtError) {
        if (isMounted) {
          setError(caughtError instanceof Error ? caughtError.message : 'No se pudo cargar la invitación.')
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadInvite()

    return () => {
      isMounted = false
    }
  }, [token, user?.id])

  const acceptInvite = async () => {
    setIsAccepting(true)
    setMessage('')
    setError('')

    try {
      const nextData = await acceptPrivateTournamentInvite(token)
      setData(nextData)
      setMessage('Invitación aceptada. Ya participás de este torneo.')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo aceptar la invitación.')
    } finally {
      setIsAccepting(false)
    }
  }

  if (isLoading || isAuthLoading) {
    return (
      <section className="hf-card rounded-2xl p-4 text-sm text-[#9aa7b5]">
        Cargando invitación...
      </section>
    )
  }

  if (error && !data) {
    return (
      <section className="hf-card rounded-2xl p-4">
        <h1 className="text-xl font-black text-white">Invitación no disponible</h1>
        <p className="mt-2 text-sm text-red-200">{error}</p>
        <Link
          href="/prode/torneos"
          className="hf-button-secondary mt-4 inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-black"
        >
          Ir a torneos
        </Link>
      </section>
    )
  }

  if (!data) return null

  const isInactive = data.invite.expired || data.invite.status === 'revoked'
  const alreadyAccepted = data.invite.status === 'accepted' || data.isMember

  return (
    <section className="hf-card mx-auto max-w-xl rounded-2xl p-4 sm:p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7ff0b2]">
        Invitación al Prode
      </p>
      <h1 className="mt-2 text-2xl font-black text-white">{data.tournament.displayName}</h1>
      <p className="mt-2 text-sm text-[#9aa7b5]">
        {data.tournament.leagueName} · {data.tournament.memberCount} participantes · Owner:{' '}
        {data.tournament.creatorName}
      </p>

      <div className="mt-4 rounded-xl border border-white/8 bg-black/25 p-3 text-sm text-[#dce7f2]">
        {isInactive
          ? 'Esta invitación ya no está disponible.'
          : alreadyAccepted
            ? 'Ya participás de este torneo.'
            : 'Aceptá la invitación para sumarte al torneo privado.'}
      </div>

      {!user ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link
            href="/login"
            className="hf-button inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-black"
          >
            Iniciar sesión para aceptar
          </Link>
          <Link
            href="/register"
            className="hf-button-secondary inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-black"
          >
            Crear cuenta
          </Link>
        </div>
      ) : alreadyAccepted ? (
        <Link
          href={`/prode/torneos/${data.tournament.id}`}
          className="hf-button mt-4 inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-black"
        >
          Ver torneo
        </Link>
      ) : (
        <button
          type="button"
          onClick={acceptInvite}
          disabled={isInactive || isAccepting}
          className="hf-button mt-4 h-11 w-full rounded-xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAccepting ? 'Aceptando...' : 'Aceptar invitación'}
        </button>
      )}

      {message ? (
        <p className="mt-3 rounded-xl border border-[#7ff0b2]/20 bg-[#10241a] px-3 py-2 text-sm font-semibold text-[#7ff0b2]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  )
}

