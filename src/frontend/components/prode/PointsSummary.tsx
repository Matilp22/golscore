'use client'

import { useTranslations } from '@/frontend/components/LocaleProvider'
import type { LeaderboardRow, Prediction } from '@/frontend/types/prode'

type PointsSummaryProps = {
  myRanking?: LeaderboardRow
  predictions: Prediction[]
}

export default function PointsSummary({
  myRanking,
  predictions,
}: PointsSummaryProps) {
  const { t } = useTranslations()
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
    { label: t('prode.points'), value: points, highlight: true },
    { label: t('prode.predictions'), value: predictions.length },
    { label: t('prode.exactHits'), value: exactHits },
  ]

  return (
    <div className="grid w-full grid-cols-3 gap-1.5 sm:gap-2 md:gap-3">
      {summaryItems.map((item) => (
        <div
          key={item.label}
          className="hf-card hf-card-hover min-h-[68px] w-full min-w-0 rounded-xl px-2 py-2 sm:min-h-[84px] sm:rounded-2xl sm:p-3 md:min-h-[92px] md:p-4"
        >
          <p className="break-words text-[9px] font-semibold uppercase leading-tight tracking-[0.04em] text-[#9adfb8] sm:text-[11px] sm:tracking-[0.12em]">
            {item.label}
          </p>
          <p className={`mt-1.5 text-2xl font-black leading-none sm:mt-3 sm:text-3xl ${item.highlight ? 'text-[#70ff9d]' : 'text-white'}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}
