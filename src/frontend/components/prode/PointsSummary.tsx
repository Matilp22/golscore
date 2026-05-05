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
  const summaryItems = [
    { label: 'Puntos', value: points, highlight: true },
    { label: 'Predicciones', value: predictions.length },
    { label: 'Exactos', value: exactHits },
  ]

  return (
    <div className="grid w-full gap-2 sm:grid-cols-3 md:gap-3">
      {summaryItems.map((item) => (
        <div
          key={item.label}
          className="min-h-[92px] w-full rounded-2xl border border-white/8 bg-[#10151a]/95 p-3 shadow-[0_10px_24px_rgba(0,0,0,0.14)] md:p-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9adfb8]">
            {item.label}
          </p>
          <p className={`mt-3 text-3xl font-black leading-none ${item.highlight ? 'text-[#7ff0b2]' : 'text-white'}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}
