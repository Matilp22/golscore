'use client'

import type { LeaderboardRow } from '@/frontend/types/prode'

type LeaderboardTableProps = {
  rows: LeaderboardRow[]
}

export default function LeaderboardTable({ rows }: LeaderboardTableProps) {
  return (
    <aside className="h-fit rounded-2xl border border-white/8 bg-[#111418]">
      <div className="border-b border-white/8 px-4 py-3">
        <h2 className="text-lg font-black text-white">Tabla de posiciones</h2>
      </div>
      {rows.length ? (
        <div className="divide-y divide-white/6">
          {rows.map((row, index) => (
            <div key={row.userId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-bold text-white">
                  {index + 1}. {row.name}
                </p>
                <p className="text-xs text-[#8d98a7]">
                  Exactos {row.exactHits} · Parciales {row.partialHits} · PJ {row.played}
                </p>
              </div>
              <span className="text-lg font-black text-[#7ff0b2]">{row.points}</span>
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
