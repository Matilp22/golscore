'use client'

import type { Match, Prediction } from '@/frontend/types/prode'
import { isPredictionLocked } from '@/frontend/types/prode'
import PredictionForm from '@/frontend/components/prode/PredictionForm'

type MatchCardProps = {
  match: Match
  prediction?: Prediction
  isAuthenticated: boolean
  isAuthLoading: boolean
  onEditingChange?: (matchId: string, isEditing: boolean) => void
  onSavePrediction: (input: {
    matchId: string
    predictedHomeScore: number
    predictedAwayScore: number
  }) => Promise<void>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function MatchCard({
  match,
  prediction,
  isAuthenticated,
  isAuthLoading,
  onEditingChange,
  onSavePrediction,
}: MatchCardProps) {
  const locked = isPredictionLocked(match.matchDate)

  return (
    <article className="min-w-0 px-3 py-3 sm:px-4">
      <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ff0b2]">
            {match.league?.name ?? 'Torneo'}
          </span>
          <span className="text-xs text-[#8d98a7]">{formatDate(match.matchDate)}</span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {match.homeScore !== null && match.awayScore !== null ? (
            <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[11px] font-bold text-white">
              {match.homeScore} - {match.awayScore}
            </span>
          ) : null}
          {prediction?.points !== undefined ? (
            <span className="rounded-full border border-[#25553d] bg-[#13251d] px-2 py-0.5 text-[11px] font-bold text-[#7ff0b2]">
              {prediction.points} pts
              {prediction.exactHit ? ' exacto' : prediction.partialHit ? ' parcial' : ''}
            </span>
          ) : null}
          {locked ? (
            <span className="rounded-full border border-[#45312f] bg-[#241918] px-2 py-0.5 text-[10px] font-bold uppercase text-[#ffb4a6]">
              Cerrado
            </span>
          ) : (
            <span className="rounded-full border border-[#25553d] bg-[#13251d] px-2 py-0.5 text-[10px] font-bold uppercase text-[#7ff0b2]">
              Abierto
            </span>
          )}
        </div>
      </div>

      <PredictionForm
        key={`${match.id}-${prediction?.updatedAt ?? 'empty'}`}
        match={match}
        prediction={prediction}
        isAuthenticated={isAuthenticated}
        isAuthLoading={isAuthLoading}
        onEditingChange={onEditingChange}
        onSave={onSavePrediction}
      />
    </article>
  )
}
