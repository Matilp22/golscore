'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { useTranslations } from '@/frontend/components/LocaleProvider'
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
  const { t } = useTranslations()
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
          setError(caughtError instanceof Error ? caughtError.message : t('privateTournaments.inviteLoadError'))
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadInvite()

    return () => {
      isMounted = false
    }
  }, [t, token, user?.id])

  const acceptInvite = async () => {
    setIsAccepting(true)
    setMessage('')
    setError('')

    try {
      const nextData = await acceptPrivateTournamentInvite(token)
      setData(nextData)
      setMessage(t('privateTournaments.inviteAccepted'))
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('privateTournaments.inviteAcceptError'))
    } finally {
      setIsAccepting(false)
    }
  }

  if (isLoading || isAuthLoading) {
    return (
      <section className="hf-card rounded-2xl p-4 text-sm text-[#9aa7b5]">
        {t('privateTournaments.invitePageLoading')}
      </section>
    )
  }

  if (error && !data) {
    return (
      <section className="hf-card rounded-2xl p-4">
        <h1 className="text-xl font-black text-white">{t('privateTournaments.inviteUnavailable')}</h1>
        <p className="mt-2 text-sm text-red-200">{error}</p>
        <Link
          href="/prode/torneos"
          className="hf-button-secondary mt-4 inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-black"
        >
          {t('privateTournaments.goToTournaments')}
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
        {t('privateTournaments.invitePageTitle')}
      </p>
      <h1 className="mt-2 text-2xl font-black text-white">{data.tournament.displayName}</h1>
      <p className="mt-2 text-sm text-[#9aa7b5]">
        {data.tournament.leagueName} {'\u00b7'} {data.tournament.memberCount}{' '}
        {t('common.participants')} {'\u00b7'}{' '}
        {t('privateTournaments.ownerLabel', { name: data.tournament.creatorName })}
      </p>

      <div className="mt-4 rounded-xl border border-white/8 bg-black/25 p-3 text-sm text-[#dce7f2]">
        {isInactive
          ? t('privateTournaments.inviteInactive')
          : alreadyAccepted
            ? t('privateTournaments.inviteAlreadyAccepted')
            : t('privateTournaments.inviteAcceptDescription')}
      </div>

      {!user ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link
            href="/login"
            className="hf-button inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-black"
          >
            {t('privateTournaments.signInToAccept')}
          </Link>
          <Link
            href="/register"
            className="hf-button-secondary inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-black"
          >
            {t('account.createAccount')}
          </Link>
        </div>
      ) : alreadyAccepted ? (
        <Link
          href={`/prode/torneos/${data.tournament.id}`}
          className="hf-button mt-4 inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-black"
        >
          {t('privateTournaments.viewTournament')}
        </Link>
      ) : (
        <button
          type="button"
          onClick={acceptInvite}
          disabled={isInactive || isAccepting}
          className="hf-button mt-4 h-11 w-full rounded-xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAccepting ? t('privateTournaments.acceptingInvite') : t('privateTournaments.acceptInvite')}
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
