'use client'

import type { LeaderboardRow } from '@/frontend/types/prode'

type LeaderboardTableProps = {
  rows: LeaderboardRow[]
}

export default function LeaderboardTable({ rows }: LeaderboardTableProps) {
  return (
    <aside className="h-fit w-full min-w-0 rounded-2xl border border-white/8 bg-[#111418]">
      <div className="border-b border-white/8 px-3 py-3 sm:px-4">
        <h2 className="text-lg font-black text-white">Tabla de posiciones</h2>
      </div>
      {rows.length ? (
        <div className="divide-y divide-white/6">
          {rows.map((row, index) => (
            <div key={row.userId} className="flex min-w-0 items-center justify-between gap-3 px-3 py-3 text-sm sm:px-4">
              <div className="min-w-0">
                <p className="break-words font-bold text-white">
                  {index + 1}. {row.name}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#8d98a7]">
                  Exactos {row.exactHits} · Parciales {row.partialHits} · PJ {row.played}
                </p>
              </div>
              <span className="shrink-0 text-lg font-black text-[#7ff0b2]">{row.points}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 text-sm text-[#8d98a7]">
          Todavía no hay puntos calculados.
        </div>
      )}
    </aside>
  )
}
