'use client'

import type { Match, Prediction } from '@/frontend/types/prode'

type PredictionCardProps = {
  prediction: Prediction
  match?: Match
}

export default function PredictionCard({
  prediction,
  match,
}: PredictionCardProps) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#0f1317] px-3 py-2 text-sm">
      <p className="font-bold text-white">
        {match?.homeTeam?.name ?? 'Local'} {prediction.predictedHomeScore} - {prediction.predictedAwayScore}{' '}
        {match?.awayTeam?.name ?? 'Visitante'}
      </p>
      <p className="mt-1 text-xs text-[#8d98a7]">
        Partido #{prediction.matchId}
      </p>
    </div>
  )
}
