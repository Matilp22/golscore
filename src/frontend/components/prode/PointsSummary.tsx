'use client'

import type { LeaderboardRow, Prediction } from '@/frontend/types/prode'

type PointsSummaryProps = {
  myRanking?: LeaderboardRow
  predictions: Prediction[]
}

export default function PointsSummary({
  myRanking,
  predictions,
}: PointsSummaryProps) {
  const points = Number.isFinite(myRanking?.points) ? myRanking?.points : 0
  const exactHits = Number.isFinite(myRanking?.exactHits) ? myRanking?.exactHits : 0

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-white/8 bg-[#111418] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7ff0b2]">
          Puntos
        </p>
        <p className="mt-2 text-2xl font-black text-white">{points}</p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-[#111418] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7ff0b2]">
          Predicciones
        </p>
        <p className="mt-2 text-2xl font-black text-white">{predictions.length}</p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-[#111418] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7ff0b2]">
          Exactos
        </p>
        <p className="mt-2 text-2xl font-black text-white">{exactHits}</p>
      </div>
    </div>
  )
}
