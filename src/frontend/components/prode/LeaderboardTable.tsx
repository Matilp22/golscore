'use client'

import { Fragment, useMemo, useState } from 'react'

import { useTranslations } from '@/frontend/components/LocaleProvider'
import type { LeaderboardPredictionDetail, LeaderboardRow, RoundOption } from '@/frontend/types/prode'

type LeaderboardTableProps = {
  rows: LeaderboardRow[]
  roundRows: LeaderboardRow[]
  rounds: RoundOption[]
  selectedRound: string | null
  isRoundLoading?: boolean
  totalMessage?: string
  roundMessage?: string
  onRoundChange: (round: string) => void
}

type RankingRowsProps = {
  rows: LeaderboardRow[]
  emptyMessage: string
  exactsLabel: string
  partialsLabel: string
  playedLabel: string
  pointsLabel: string
  expandable?: boolean
  labels: PredictionLabels
  locale: string
}

type PredictionLabels = {
  lockedPredictionsTitle: string
  lockedPredictionsHint: string
  noLockedPredictions: string
  predictionLabel: string
  resultLabel: string
  pendingScoreLabel: string
  matchPointsLabel: (points: number) => string
  expandUserPredictions: (user: string) => string
  collapseUserPredictions: (user: string) => string
}

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
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function TeamName({
  name,
  logoUrl,
  align = 'left',
}: {
  name: string
  logoUrl: string | null
  align?: 'left' | 'right'
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'justify-end text-right' : ''}`}>
      {align === 'right' ? null : (
        <span className="flex h-5 w-5 shrink-0 overflow-hidden rounded-full bg-white/8">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
          ) : null}
        </span>
      )}
      <span className="min-w-0 truncate text-xs font-black text-white">{name}</span>
      {align === 'right' ? (
        <span className="flex h-5 w-5 shrink-0 overflow-hidden rounded-full bg-white/8">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
          ) : null}
        </span>
      ) : null}
    </div>
  )
}

function formatResult(prediction: LeaderboardPredictionDetail) {
  if (prediction.realHomeScore === null || prediction.realAwayScore === null) return null

  return `${prediction.realHomeScore} - ${prediction.realAwayScore}`
}

function PredictionDetails({
  row,
  labels,
  locale,
  pointsLabel,
}: {
  row: LeaderboardRow
  labels: PredictionLabels
  locale: string
  pointsLabel: string
}) {
  return (
    <div className="border-t border-white/6 bg-black/[0.18] px-3 py-3 sm:px-4">
      <div className="mb-3 flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[#7ff0b2]">
            {labels.lockedPredictionsTitle}
          </p>
          <p className="mt-0.5 text-xs text-[#8d98a7]">{labels.lockedPredictionsHint}</p>
        </div>
        <p className="shrink-0 text-xs font-black text-[#dce7f2]">
          {row.points} {pointsLabel}
        </p>
      </div>

      {row.predictions.length ? (
        <div className="grid gap-2">
          {row.predictions.map((prediction) => {
            const realResult = formatResult(prediction)
            const pointsTone = prediction.exactHit
              ? 'border-[#7ff0b2]/25 bg-[#7ff0b2]/[0.12] text-[#7ff0b2]'
              : prediction.partialHit
                ? 'border-amber-300/25 bg-amber-300/[0.12] text-amber-200'
                : prediction.scoreCalculated
                  ? 'border-white/10 bg-white/[0.04] text-[#dce7f2]'
                  : 'border-white/8 bg-black/25 text-[#9aa7b5]'

            return (
              <article
                key={prediction.predictionId}
                className="rounded-xl border border-white/8 bg-white/[0.025] p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#8d98a7]">
                  <span>{formatDate(prediction.matchDate, locale)}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 ${pointsTone}`}>
                    {prediction.scoreCalculated
                      ? labels.matchPointsLabel(prediction.points ?? 0)
                      : labels.pendingScoreLabel}
                  </span>
                </div>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                  <TeamName name={prediction.homeTeamName} logoUrl={prediction.homeLogoUrl} />
                  <span className="rounded-lg border border-white/8 bg-black/25 px-2 py-1 text-sm font-black text-white">
                    {prediction.predictedHomeScore} - {prediction.predictedAwayScore}
                  </span>
                  <TeamName
                    name={prediction.awayTeamName}
                    logoUrl={prediction.awayLogoUrl}
                    align="right"
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-white/6 bg-black/20 px-2 py-1.5">
                    <p className="font-bold uppercase tracking-[0.05em] text-[#8d98a7]">
                      {labels.predictionLabel}
                    </p>
                    <p className="mt-0.5 font-black text-white">
                      {prediction.predictedHomeScore} - {prediction.predictedAwayScore}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/6 bg-black/20 px-2 py-1.5">
                    <p className="font-bold uppercase tracking-[0.05em] text-[#8d98a7]">
                      {labels.resultLabel}
                    </p>
                    <p className="mt-0.5 font-black text-white">
                      {realResult ?? labels.pendingScoreLabel}
                    </p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-4 text-sm text-[#9aa7b5]">
          {labels.noLockedPredictions}
        </div>
      )}
    </div>
  )
}

function RankingRows({
  rows,
  emptyMessage,
  exactsLabel,
  partialsLabel,
  playedLabel,
  pointsLabel,
  expandable = false,
  labels,
  locale,
}: RankingRowsProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  if (!rows.length) {
    return (
      <div className="p-4 text-sm text-[#8d98a7]">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="divide-y divide-white/6">
      {rows.map((row, index) => {
        const isExpanded = expandable && expandedUserId === row.userId

        return (
          <Fragment key={row.userId}>
            <div className="flex min-w-0 items-center justify-between gap-2 px-3 py-2 text-xs transition hover:bg-[rgba(112,255,157,0.045)] sm:px-4">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#70ff9d]/20 bg-[#70ff9d]/10 text-[11px] font-black text-[#9adfb8]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  {expandable ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedUserId((current) =>
                          current === row.userId ? null : row.userId
                        )
                      }
                      aria-expanded={isExpanded}
                      aria-label={
                        isExpanded
                          ? labels.collapseUserPredictions(row.name)
                          : labels.expandUserPredictions(row.name)
                      }
                      className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg text-left font-bold text-white transition hover:text-[#7ff0b2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7ff0b2]"
                    >
                      <span className="min-w-0 truncate">{row.name}</span>
                      <span
                        aria-hidden="true"
                        className={`shrink-0 text-[10px] text-[#7ff0b2] transition ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      >
                        ▼
                      </span>
                    </button>
                  ) : (
                    <p className="break-words font-bold text-white">{row.name}</p>
                  )}
                  <p className="mt-0.5 text-xs leading-5 text-[#8d98a7]">
                    {exactsLabel} {row.exactHits} {'\u00b7'} {partialsLabel} {row.partialHits}{' '}
                    {'\u00b7'} {playedLabel} {row.played}
                  </p>
                </div>
              </div>
              <span className="hf-badge shrink-0 rounded-lg px-2 py-0.5 text-base font-black">
                {row.points} {pointsLabel}
              </span>
            </div>
            {isExpanded ? (
              <PredictionDetails
                row={row}
                labels={labels}
                locale={locale}
                pointsLabel={pointsLabel}
              />
            ) : null}
          </Fragment>
        )
      })}
    </div>
  )
}

export default function LeaderboardTable({
  rows,
  roundRows,
  rounds,
  selectedRound,
  isRoundLoading = false,
  totalMessage,
  roundMessage,
  onRoundChange,
}: LeaderboardTableProps) {
  const { locale, t } = useTranslations()
  const [activeTab, setActiveTab] = useState<'total' | 'round'>('total')
  const selectedRoundOption = useMemo(
    () => rounds.find((round) => round.value === selectedRound) ?? rounds[0] ?? null,
    [rounds, selectedRound]
  )

  const activeRows = activeTab === 'total' ? rows : roundRows
  const emptyMessage =
    activeTab === 'total'
      ? totalMessage || t('prode.noPointsTotal')
      : roundMessage || t('prode.noPointsRound')
  const predictionLabels: PredictionLabels = {
    lockedPredictionsTitle: t('prode.lockedPredictionsTitle'),
    lockedPredictionsHint: t('prode.lockedPredictionsHint'),
    noLockedPredictions: t('prode.noLockedPredictions'),
    predictionLabel: t('prode.predictionLabel'),
    resultLabel: t('prode.resultLabel'),
    pendingScoreLabel: t('prode.pendingScoreLabel'),
    matchPointsLabel: (points: number) =>
      t('prode.matchPointsLabel', { points: String(points) }),
    expandUserPredictions: (username: string) =>
      t('prode.expandUserPredictions', { user: username }),
    collapseUserPredictions: (username: string) =>
      t('prode.collapseUserPredictions', { user: username }),
  }

  return (
    <aside className="hf-card h-fit w-full min-w-0 overflow-hidden rounded-2xl">
      <div className="hf-section-head px-3 py-3 sm:px-4">
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lg font-black text-white">{t('prode.rankingTitle')}</h2>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/8 bg-black/25 p-1">
            {[
              { key: 'total', label: t('prode.total') },
              { key: 'round', label: t('prode.byRound') },
            ].map((tab) => {
              const isActive = activeTab === tab.key

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as 'total' | 'round')}
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

          {activeTab === 'round' ? (
            <select
              value={selectedRoundOption?.value ?? ''}
              onChange={(event) => onRoundChange(event.target.value)}
              disabled={!rounds.length}
              className="hf-input h-10 w-full rounded-xl px-3 text-sm font-semibold outline-none transition disabled:cursor-not-allowed disabled:text-[#8d98a7]"
            >
              {rounds.length ? (
                rounds.map((round) => (
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

      {activeTab === 'round' && isRoundLoading ? (
        <div className="p-4 text-sm text-[#8d98a7]">{t('prode.loadingRound')}</div>
      ) : (
        <RankingRows
          key={`${activeTab}:${selectedRoundOption?.value ?? 'total'}`}
          rows={activeRows}
          emptyMessage={emptyMessage}
          exactsLabel={t('common.exacts')}
          partialsLabel={t('common.partials')}
          playedLabel={t('common.playedShort')}
          pointsLabel={t('common.pointsAbbr')}
          expandable={activeTab === 'round'}
          labels={predictionLabels}
          locale={locale}
        />
      )}
    </aside>
  )
}
