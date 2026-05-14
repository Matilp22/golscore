'use client'

import { useMemo, useState } from 'react'
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
}

function RankingRows({ rows, emptyMessage }: RankingRowsProps) {
  if (!rows.length) {
    return (
      <div className="p-4 text-sm text-[#8d98a7]">
        {emptyMessage}
      </div>
    )
  }

  return (
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
              <p className="break-words font-bold text-white">{row.name}</p>
              <p className="mt-0.5 text-xs leading-5 text-[#8d98a7]">
                Exactos {row.exactHits} {'\u00b7'} Parciales {row.partialHits}{' '}
                {'\u00b7'} PJ {row.played}
              </p>
            </div>
          </div>
          <span className="hf-badge shrink-0 rounded-lg px-2 py-0.5 text-base font-black">
            {row.points} pts
          </span>
        </div>
      ))}
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
  const [activeTab, setActiveTab] = useState<'total' | 'round'>('total')
  const selectedRoundOption = useMemo(
    () => rounds.find((round) => round.value === selectedRound) ?? rounds[0] ?? null,
    [rounds, selectedRound]
  )

  const activeRows = activeTab === 'total' ? rows : roundRows
  const emptyMessage =
    activeTab === 'total'
      ? totalMessage || 'Todavía no hay puntos computados.'
      : roundMessage || 'Todavía no hay puntos para esta fecha.'

  return (
    <aside className="hf-card h-fit w-full min-w-0 overflow-hidden rounded-2xl">
      <div className="hf-section-head px-3 py-3 sm:px-4">
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lg font-black text-white">Ranking del Prode</h2>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/8 bg-black/25 p-1">
            {[
              { key: 'total', label: 'Total' },
              { key: 'round', label: 'Por fecha' },
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
                <option value="">Sin fecha disponible</option>
              )}
            </select>
          ) : null}
        </div>
      </div>

      {activeTab === 'round' && isRoundLoading ? (
        <div className="p-4 text-sm text-[#8d98a7]">Cargando fecha...</div>
      ) : (
        <RankingRows rows={activeRows} emptyMessage={emptyMessage} />
      )}
    </aside>
  )
}
