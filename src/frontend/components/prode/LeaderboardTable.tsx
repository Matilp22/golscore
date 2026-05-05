'use client'

import type { LeaderboardRow } from '@/frontend/types/prode'

type LeaderboardTableProps = {
  rows: LeaderboardRow[]
}

export default function LeaderboardTable({ rows }: LeaderboardTableProps) {
  return (
    <aside className="h-fit w-full min-w-0 overflow-hidden rounded-2xl border border-white/8 bg-[#10151a]/95 shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
      <div className="border-b border-white/7 px-3 py-3 sm:px-4">
        <h2 className="text-lg font-black text-white">Tabla de posiciones</h2>
      </div>
      {rows.length ? (
        <div className="divide-y divide-white/6">
          {rows.map((row, index) => (
            <div
              key={row.userId}
              className="flex min-w-0 items-center justify-between gap-3 px-3 py-3 text-sm transition hover:bg-white/[0.025] sm:px-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-xs font-black text-[#9adfb8]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="break-words font-bold text-white">{row.name}</p>
                  <p className="mt-0.5 text-xs leading-5 text-[#8d98a7]">
                    Exactos {row.exactHits} / Parciales {row.partialHits} / PJ {row.played}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-[#13251d] px-2.5 py-1 text-lg font-black text-[#7ff0b2]">
                {row.points}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 text-sm text-[#8d98a7]">
          Todavia no hay puntos calculados.
        </div>
      )}
    </aside>
  )
}
