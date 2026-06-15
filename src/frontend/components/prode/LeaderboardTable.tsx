'use client'

import { useMemo, useState } from 'react'

import { useTranslations } from '@/frontend/components/LocaleProvider'
import LockedPredictionsModal from '@/frontend/components/prode/LockedPredictionsModal'
import type { LeaderboardRow, RoundOption } from '@/frontend/types/prode'

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
  closeLabel: string
  matchPointsLabel: (points: number) => string
  expandUserPredictions: (user: string) => string
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
  const [selectedRow, setSelectedRow] = useState<LeaderboardRow | null>(null)

  if (!rows.length) {
    return <div className="p-4 text-sm text-[#8d98a7]">{emptyMessage}</div>
  }

  return (
    <>
      <div className="divide-y divide-white/6">
        {rows.map((row, index) => (
          <div
            key={row.userId}
            className="flex min-w-0 items-center justify-between gap-2 px-3 py-2 text-xs transition hover:bg-[rgba(112,255,157,0.045)] sm:px-4"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#70ff9d]/20 bg-[#70ff9d]/10 text-[11px] font-black text-[#9adfb8]">
                {index + 1}
              </span>
              <div className="min-w-0">
                {expandable ? (
                  <button
                    type="button"
                    onClick={() => setSelectedRow(row)}
                    aria-haspopup="dialog"
                    aria-label={labels.expandUserPredictions(row.name)}
                    className="block min-w-0 max-w-full rounded-lg text-left font-bold text-white transition hover:text-[#7ff0b2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7ff0b2]"
                  >
                    <span className="block min-w-0 truncate">{row.name}</span>
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
        ))}
      </div>

      {selectedRow ? (
        <LockedPredictionsModal
          userName={selectedRow.name}
          totalPoints={selectedRow.points}
          predictions={selectedRow.predictions}
          labels={{
            title: labels.lockedPredictionsTitle,
            hint: labels.lockedPredictionsHint,
            noPredictions: labels.noLockedPredictions,
            prediction: labels.predictionLabel,
            result: labels.resultLabel,
            pendingScore: labels.pendingScoreLabel,
            points: pointsLabel,
            close: labels.closeLabel,
            matchPoints: labels.matchPointsLabel,
          }}
          locale={locale}
          onClose={() => setSelectedRow(null)}
        />
      ) : null}
    </>
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
  const [activeTab, setActiveTab] = useState<'total' | 'round'>('round')
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
    closeLabel: t('common.close'),
    matchPointsLabel: (points: number) =>
      t('prode.matchPointsLabel', { points: String(points) }),
    expandUserPredictions: (username: string) =>
      t('prode.expandUserPredictions', { user: username }),
  }

  return (
    <aside className="hf-card h-fit w-full min-w-0 overflow-hidden rounded-2xl">
      <div className="hf-section-head px-3 py-3 sm:px-4">
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lg font-black text-white">{t('prode.rankingTitle')}</h2>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/8 bg-black/25 p-1">
            {[
              { key: 'round', label: t('prode.byRound') },
              { key: 'total', label: t('prode.total') },
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
