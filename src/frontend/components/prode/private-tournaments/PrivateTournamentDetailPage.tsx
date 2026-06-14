'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useTranslations } from '@/frontend/components/LocaleProvider'
import PrivateTournamentChat from '@/frontend/components/prode/private-tournaments/PrivateTournamentChat'
import { useAuth } from '@/frontend/hooks/useAuth'
import {
  approvePrivateTournamentRequest,
  createPrivateTournamentInvite,
  getPrivateTournamentDetail,
  rejectPrivateTournamentRequest,
} from '@/frontend/services/privateTournamentsService'
import type {
  PrivateTournamentDetail,
  PrivateTournamentInvite,
  PrivateTournamentRankingRow,
} from '@/frontend/types/private-tournaments'

type PrivateTournamentDetailPageProps = {
  tournamentId: string
}

type RankingMode = 'total' | 'round'

const DATE_LOCALE: Record<string, string> = {
  es: 'es-AR',
  en: 'en-US',
  pt: 'pt-BR',
  fr: 'fr-FR',
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? locale, {
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
  labels,
}: {
  rows: PrivateTournamentRankingRow[]
  emptyMessage: string
  labels: {
    position: string
    user: string
    points: string
    exacts: string
    partials: string
    played: string
  }
}) {
  if (!rows.length) {
    return <EmptyState>{emptyMessage}</EmptyState>
  }

  return (
    <div className="overflow-hidden">
      <table className="hf-table w-full table-fixed border-separate border-spacing-0 text-left text-[11px] sm:text-sm">
        <thead className="text-xs uppercase text-[#8d98a7]">
          <tr>
            <th className="px-3 py-2 font-black">{labels.position}</th>
            <th className="px-3 py-2 font-black">{labels.user}</th>
            <th className="px-3 py-2 text-right font-black">{labels.points}</th>
            <th className="px-3 py-2 text-right font-black">{labels.exacts}</th>
            <th className="px-3 py-2 text-right font-black">{labels.partials}</th>
            <th className="px-3 py-2 text-right font-black">{labels.played}</th>
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
  pointsLabel,
  exactsLabel,
  partialsLabel,
}: {
  label: string
  row: PrivateTournamentRankingRow
  variant: 'gold' | 'silver' | 'fun'
  pointsLabel: string
  exactsLabel: string
  partialsLabel: string
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
        {row.points} {pointsLabel} {'\u00b7'} {row.exactHits} {exactsLabel} {'\u00b7'}{' '}
        {row.partialHits} {partialsLabel}
      </p>
    </div>
  )
}

function InviteModal({
  tournamentId,
  onClose,
  onMessage,
  onError,
}: {
  tournamentId: string
  onClose: () => void
  onMessage: (message: string) => void
  onError: (message: string) => void
}) {
  const { t } = useTranslations()
  const [invite, setInvite] = useState<PrivateTournamentInvite | null>(null)
  const [email, setEmail] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const canUseWebShare = typeof navigator !== 'undefined' && 'share' in navigator

  const createInvite = useCallback(async (nextEmail?: string) => {
    setIsCreating(true)

    try {
      const nextInvite = await createPrivateTournamentInvite(tournamentId, {
        email: nextEmail?.trim() || undefined,
      })
      setInvite(nextInvite)
      onMessage(
        nextEmail
          ? t('privateTournaments.inviteEmailReady')
          : t('privateTournaments.inviteLinkCreated')
      )
      return nextInvite
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : t('privateTournaments.inviteCreateError')
      onError(message)
      return null
    } finally {
      setIsCreating(false)
    }
  }, [onError, onMessage, t, tournamentId])

  useEffect(() => {
    void createInvite()
  }, [createInvite])

  const copyLink = async () => {
    if (!invite?.inviteUrl) return

    await navigator.clipboard?.writeText(invite.inviteUrl)
    onMessage(t('privateTournaments.linkCopied'))
  }

  const shareLink = async () => {
    if (!invite?.inviteUrl || !canUseWebShare) return

    await navigator.share({
      title: t('privateTournaments.inviteShareTitle'),
      text: t('privateTournaments.inviteShareText'),
      url: invite.inviteUrl,
    })
  }

  const sendEmail = async () => {
    const nextInvite = await createInvite(email)
    if (nextInvite?.mailtoUrl) {
      window.location.href = nextInvite.mailtoUrl
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-3 py-4 backdrop-blur-sm sm:items-center">
      <div className="hf-card w-full max-w-lg rounded-2xl p-4 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">{t('privateTournaments.inviteTitle')}</h2>
            <p className="mt-1 text-sm text-[#9aa7b5]">
              {t('privateTournaments.inviteDescription')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hf-button-secondary h-9 rounded-xl px-3 text-sm font-black"
          >
            {t('common.close')}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-black uppercase tracking-[0.12em] text-[#8d98a7]">
            {t('common.link')}
          </label>
          <div className="rounded-xl border border-white/8 bg-black/25 p-3 text-sm text-[#dce7f2]">
            {isCreating && !invite ? t('privateTournaments.generatingLink') : invite?.inviteUrl ?? t('common.notAvailable')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={copyLink}
              disabled={!invite}
              className="hf-button h-10 rounded-xl px-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('common.copyLink')}
            </button>
            <button
              type="button"
              onClick={shareLink}
              disabled={!invite || !canUseWebShare}
              className="hf-button-secondary h-10 rounded-xl px-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('common.share')}
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black uppercase tracking-[0.12em] text-[#8d98a7]">
              {t('common.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@ejemplo.com"
              className="hf-input h-11 w-full rounded-xl px-3 text-sm font-semibold outline-none"
            />
            <button
              type="button"
              onClick={sendEmail}
              disabled={isCreating}
              className="hf-button-secondary h-10 w-full rounded-xl px-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('common.email')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PrivateTournamentDetailPage({
  tournamentId,
}: PrivateTournamentDetailPageProps) {
  const { locale, t } = useTranslations()
  const { user, isLoading: isAuthLoading } = useAuth()
  const [tournament, setTournament] = useState<PrivateTournamentDetail | null>(null)
  const [mode, setMode] = useState<RankingMode>('total')
  const [selectedRound, setSelectedRound] = useState('')
  const [selectedHonorRound, setSelectedHonorRound] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
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
        caughtError instanceof Error ? caughtError.message : t('privateTournaments.loadTournamentError')
      )
    } finally {
      setIsLoading(false)
    }
  }, [t, tournamentId, user])

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
      setMessage(action === 'approve' ? t('privateTournaments.approved') : t('privateTournaments.rejected'))
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t('privateTournaments.reviewError')
      )
    } finally {
      setReviewingRequestId(null)
    }
  }

  if (isAuthLoading || isLoading) {
    return (
      <section className="hf-card rounded-2xl p-4 text-sm text-[#9aa7b5]">
        {t('privateTournaments.loadingTournament')}
      </section>
    )
  }

  if (!user) {
    return (
      <section className="hf-card rounded-2xl p-4">
        <h2 className="text-lg font-black text-white">{t('privateTournaments.detailTitle')}</h2>
        <p className="mt-2 text-sm text-[#9aa7b5]">
          {t('privateTournaments.detailLoginRequired')}
        </p>
      </section>
    )
  }

  if (error && !tournament) {
    return (
      <section className="hf-card rounded-2xl p-4">
        <h2 className="text-lg font-black text-white">{t('privateTournaments.detailTitle')}</h2>
        <p className="mt-2 text-sm text-red-200">{error}</p>
        <Link
          href="/prode/torneos"
          className="hf-button-secondary mt-4 inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-black"
        >
          {t('privateTournaments.backToTournaments')}
        </Link>
      </section>
    )
  }

  if (!tournament) return null

  const isOwner = tournament.currentUserRole === 'owner'
  const rankingLabels = {
    position: t('common.position'),
    user: t('common.user'),
    points: t('common.pointsAbbr'),
    exacts: t('common.exacts'),
    partials: t('common.partials'),
    played: t('common.playedShort'),
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <section className="hf-hero overflow-hidden rounded-3xl p-3 sm:p-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-black text-white sm:text-3xl">
              {tournament.displayName}
            </h1>
            <p className="mt-2 text-sm text-[#9aa7b5]">
              {tournament.memberCount} {t('common.participants')}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {isOwner ? (
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="hf-button inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-black"
              >
                {t('privateTournaments.invite')}
              </button>
            ) : null}
            <Link
              href="/prode/torneos"
              className="hf-button-secondary inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-black"
            >
              {t('common.back')}
            </Link>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-4">
        <section className="hf-card min-w-0 overflow-hidden rounded-2xl">
          <div className="hf-section-head px-3 py-3 sm:px-4">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-black text-white">{t('privateTournaments.tournamentTable')}</h2>
                <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-white/8 bg-black/25 p-1 sm:w-56">
                  {[
                    { key: 'total', label: t('prode.total') },
                    { key: 'round', label: t('prode.byRound') },
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
                    <option value="">{t('prode.noRound')}</option>
                  )}
                </select>
              ) : null}
            </div>
          </div>

          <RankingTable
            rows={activeRows}
            labels={rankingLabels}
            emptyMessage={
              mode === 'total'
                ? t('prode.noPointsTotal')
                : t('prode.noPointsRound')
            }
          />
        </section>

        <aside className="min-w-0 space-y-3">
          <PrivateTournamentChat
            tournamentId={tournament.id}
            tournamentName={tournament.displayName}
          />

          <section className="hf-card overflow-hidden rounded-2xl">
            <div className="hf-section-head px-3 py-3 sm:px-4">
              <h2 className="text-lg font-black text-white">{t('privateTournaments.honorsTitle')}</h2>
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
                  <option value="">{t('prode.noRound')}</option>
                )}
              </select>
              {honorRows.first ? (
                <HonorBadge
                  label={t('privateTournaments.honorFirst')}
                  row={honorRows.first}
                  variant="gold"
                  pointsLabel={t('common.pointsAbbr')}
                  exactsLabel={t('common.exacts').toLowerCase()}
                  partialsLabel={t('common.partials').toLowerCase()}
                />
              ) : (
                <EmptyState>{t('privateTournaments.noHonorPoints')}</EmptyState>
              )}
              {honorRows.second ? (
                <HonorBadge
                  label={t('privateTournaments.honorSecond')}
                  row={honorRows.second}
                  variant="silver"
                  pointsLabel={t('common.pointsAbbr')}
                  exactsLabel={t('common.exacts').toLowerCase()}
                  partialsLabel={t('common.partials').toLowerCase()}
                />
              ) : null}
              {honorRows.last ? (
                <HonorBadge
                  label={t('privateTournaments.honorLast')}
                  row={honorRows.last}
                  variant="fun"
                  pointsLabel={t('common.pointsAbbr')}
                  exactsLabel={t('common.exacts').toLowerCase()}
                  partialsLabel={t('common.partials').toLowerCase()}
                />
              ) : null}
            </div>
          </section>

          {isOwner ? (
            <section className="hf-card overflow-hidden rounded-2xl">
              <div className="hf-section-head px-3 py-3 sm:px-4">
                <h2 className="text-lg font-black text-white">{t('privateTournaments.joinRequests')}</h2>
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
                        {t('privateTournaments.requestedAccess', {
                          date: formatDate(request.requestedAt, locale),
                        })}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => reviewRequest(request.id, 'approve')}
                          disabled={reviewingRequestId === request.id}
                          className="hf-button h-9 rounded-xl px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t('privateTournaments.approve')}
                        </button>
                        <button
                          type="button"
                          onClick={() => reviewRequest(request.id, 'reject')}
                          disabled={reviewingRequestId === request.id}
                          className="hf-button-secondary h-9 rounded-xl px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t('privateTournaments.reject')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>{t('privateTournaments.noPendingRequests')}</EmptyState>
              )}
            </section>
          ) : null}

          <section className="hf-card overflow-hidden rounded-2xl">
            <div className="hf-section-head px-3 py-3 sm:px-4">
              <h2 className="text-lg font-black text-white">{t('privateTournaments.members')}</h2>
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
                      {t('privateTournaments.memberSince', {
                        date: formatDate(member.joinedAt, locale),
                      })}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[11px] font-black uppercase text-[#9aa7b5]">
                    {member.role === 'owner' ? t('common.owner') : t('common.member')}
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
      {isInviteModalOpen ? (
        <InviteModal
          tournamentId={tournamentId}
          onClose={() => setIsInviteModalOpen(false)}
          onMessage={setMessage}
          onError={setError}
        />
      ) : null}
    </div>
  )
}
