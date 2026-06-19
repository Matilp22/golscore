'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useState } from 'react'

import { useTranslations } from '@/frontend/components/LocaleProvider'
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
import { getTournamentDisplayName, type AppLocale } from '@/shared/i18n/locales'

function getRequestLabel(status: JoinRequestStatus | null, translate: ReturnType<typeof useTranslations>['t']) {
  if (status === 'pending') return translate('privateTournaments.joinStatusPending')
  if (status === 'approved') return translate('privateTournaments.joinStatusApproved')
  if (status === 'rejected') return translate('privateTournaments.joinStatusRejected')
  if (status === 'cancelled') return translate('privateTournaments.joinStatusCancelled')
  return null
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-5 text-sm text-[#9aa7b5]">
      {children}
    </div>
  )
}

const PRODE_TOURNAMENT_OPTIONS = [
  { externalId: '1', key: 'selecciones-mundial', fallback: 'Copa del Mundo 2026' },
  { externalId: '128', key: 'argentina-liga-profesional', fallback: 'Liga Profesional Argentina' },
  { externalId: '129', key: 'argentina-primera-nacional', fallback: 'Primera Nacional' },
  { externalId: '906', key: 'argentina-torneo-proyeccion', fallback: 'Torneo Proyección' },
]

function getTournamentOptionName(option: (typeof PRODE_TOURNAMENT_OPTIONS)[number], locale: AppLocale) {
  return getTournamentDisplayName(option.key, option.fallback, locale)
}

export default function PrivateTournamentsPage() {
  const { locale, t } = useTranslations()
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
          : t('privateTournaments.loadError')
      )
    } finally {
      setIsLoading(false)
    }
  }, [t, user])

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
      setMessage(t('privateTournaments.created'))
      await loadTournaments()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : t('privateTournaments.createError')
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
        caughtError instanceof Error ? caughtError.message : t('privateTournaments.searchError')
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
      setMessage(t('privateTournaments.requestSent'))
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t('privateTournaments.requestError')
      )
    } finally {
      setIsRequesting(false)
    }
  }

  if (isAuthLoading) {
    return (
      <section className="hf-card rounded-2xl p-4 text-sm text-[#9aa7b5]">
        {t('privateTournaments.loadingSession')}
      </section>
    )
  }

  if (!user) {
    return (
      <section className="hf-card rounded-2xl p-4">
        <h2 className="text-lg font-black text-white">{t('privateTournaments.title')}</h2>
        <p className="mt-2 text-sm text-[#9aa7b5]">
          {t('privateTournaments.loginRequired')}
        </p>
      </section>
    )
  }

  return (
    <div className="grid w-full min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-4">
      <section className="hf-card min-w-0 rounded-2xl">
        <div className="hf-section-head px-3 py-3 sm:px-4">
          <h2 className="text-lg font-black text-white">{t('privateTournaments.myTournaments')}</h2>
        </div>
        <div className="space-y-3 p-3 sm:p-4">
          {isLoading ? (
            <EmptyState>{t('privateTournaments.loadingTournaments')}</EmptyState>
          ) : tournaments.length ? (
            tournaments.map((tournament) => (
              <Link
                key={tournament.id}
                href={`/prode/torneos/${tournament.id}`}
                className="hf-card-hover block rounded-2xl border border-white/8 bg-black/20 p-3 transition hover:border-[#70ff9d]/30"
              >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words text-base font-black text-white">
                      {tournament.displayName}
                    </h3>
                    <p className="mt-1 text-sm text-[#9aa7b5]">
                      {tournament.memberCount} {t('common.participants')}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#dce7f2]">
                      {t('privateTournaments.myPosition')}:{' '}
                      {tournament.myPosition
                        ? `#${tournament.myPosition}`
                        : t('privateTournaments.noPointsYet')}{' '}
                      {'\u00b7'} {tournament.myPoints} {t('common.pointsAbbr')}
                    </p>
                  </div>
                  <span className="hf-button inline-flex h-10 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-black transition">
                    {t('privateTournaments.viewTournament')}
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <EmptyState>{t('privateTournaments.noTournaments')}</EmptyState>
          )}
        </div>
      </section>

      <aside className="min-w-0 space-y-3">
        <section className="hf-card rounded-2xl">
          <div className="hf-section-head px-3 py-3 sm:px-4">
            <h2 className="text-lg font-black text-white">{t('privateTournaments.createTitle')}</h2>
          </div>
          <form onSubmit={handleCreate} className="space-y-3 p-3 sm:p-4">
            <input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={t('privateTournaments.namePlaceholder')}
              className="hf-input h-11 w-full rounded-xl px-3 text-sm font-semibold outline-none transition placeholder:text-[#657384]"
            />
            <select
              value={createLeagueExternalId}
              onChange={(event) => setCreateLeagueExternalId(event.target.value)}
              className="hf-input h-11 w-full rounded-xl px-3 text-sm font-semibold outline-none transition"
            >
              {PRODE_TOURNAMENT_OPTIONS.map((option) => (
                <option key={option.externalId} value={option.externalId}>
                  {getTournamentOptionName(option, locale)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isCreating}
              className="hf-button h-11 w-full rounded-xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? t('privateTournaments.creating') : t('privateTournaments.createAction')}
            </button>
          </form>
        </section>

        <section className="hf-card rounded-2xl">
          <div className="hf-section-head px-3 py-3 sm:px-4">
            <h2 className="text-lg font-black text-white">{t('privateTournaments.searchTitle')}</h2>
          </div>
          <form onSubmit={handleSearch} className="space-y-3 p-3 sm:p-4">
            <input
              value={searchName}
              onChange={(event) => setSearchName(event.target.value)}
              placeholder={t('privateTournaments.exactNamePlaceholder')}
              className="hf-input h-11 w-full rounded-xl px-3 text-sm font-semibold outline-none transition placeholder:text-[#657384]"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="hf-button-secondary h-11 w-full rounded-xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSearching ? t('privateTournaments.searching') : t('privateTournaments.searchAction')}
            </button>
          </form>
          <div className="px-3 pb-3 sm:px-4 sm:pb-4">
            {searchDone && !searchResult ? (
              <EmptyState>{t('privateTournaments.notFound')}</EmptyState>
            ) : null}

            {searchResult ? (
              <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                <h3 className="break-words text-base font-black text-white">
                  {searchResult.displayName}
                </h3>
                <p className="mt-1 text-sm text-[#9aa7b5]">
                  {searchResult.leagueName} {'\u00b7'} {searchResult.memberCount}{' '}
                  {t('common.participants')}
                </p>
                <p className="mt-2 text-sm font-semibold text-[#dce7f2]">
                  {searchResult.isMember
                    ? t('privateTournaments.alreadyMember')
                    : getRequestLabel(searchResult.requestStatus, t) ??
                      t('privateTournaments.canRequest')}
                </p>
                {searchResult.canRequest ? (
                  <button
                    type="button"
                    onClick={handleRequestAccess}
                    disabled={isRequesting}
                    className="hf-button mt-3 h-10 w-full rounded-xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRequesting
                      ? t('privateTournaments.requesting')
                      : searchResult.requestStatus === 'rejected'
                        ? t('privateTournaments.requestAgain')
                        : t('privateTournaments.requestAccess')}
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
