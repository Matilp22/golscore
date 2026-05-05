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
  const localPoints = predictions.reduce((sum, prediction) => sum + (prediction.points ?? 0), 0)
  const localExactHits = predictions.filter((prediction) => prediction.exactHit).length
  const hasLoadedPredictions = predictions.length > 0
  const points = hasLoadedPredictions
    ? localPoints
    : Number.isFinite(myRanking?.points)
      ? myRanking?.points ?? 0
      : 0
  const exactHits = hasLoadedPredictions
    ? localExactHits
    : Number.isFinite(myRanking?.exactHits)
      ? myRanking?.exactHits ?? 0
      : 0

  return (
    <div className="grid w-full gap-3 md:grid-cols-3">
      <div className="w-full rounded-2xl border border-white/8 bg-[#111418] p-2 sm:p-3 md:p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7ff0b2]">
          Puntos
        </p>
        <p className="mt-2 text-2xl font-black text-white">{points}</p>
      </div>
      <div className="w-full rounded-2xl border border-white/8 bg-[#111418] p-2 sm:p-3 md:p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7ff0b2]">
          Predicciones
        </p>
        <p className="mt-2 text-2xl font-black text-white">{predictions.length}</p>
      </div>
      <div className="w-full rounded-2xl border border-white/8 bg-[#111418] p-2 sm:p-3 md:p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7ff0b2]">
          Exactos
        </p>
        <p className="mt-2 text-2xl font-black text-white">{exactHits}</p>
      </div>
    </div>
  )
}
