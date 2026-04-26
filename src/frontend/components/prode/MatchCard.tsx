'use client'

import type { Match, Prediction } from '@/frontend/types/prode'
import PredictionForm from '@/frontend/components/prode/PredictionForm'
import { parseMatchDate } from '@/shared/utils/prediction-lock'

type MatchCardProps = {
  match: Match
  prediction?: Prediction
  draft?: {
    home: string
    away: string
  }
  isAuthenticated: boolean
  isAuthLoading: boolean
  onEditingChange?: (matchId: string, isEditing: boolean) => void
  onDraftChange?: (matchId: string, draft: { home: string; away: string }) => void
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
    hour12: false,
  }).format(parseMatchDate(value))
}

export default function MatchCard({
  match,
  prediction,
  draft,
  isAuthenticated,
  isAuthLoading,
  onEditingChange,
  onDraftChange,
  onSavePrediction,
}: MatchCardProps) {
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
          {prediction?.points !== undefined ? (
            <span className="rounded-full border border-[#25553d] bg-[#13251d] px-2 py-0.5 text-[11px] font-bold text-[#7ff0b2]">
              {prediction.points} pts
              {prediction.exactHit ? ' exacto' : prediction.partialHit ? ' parcial' : ''}
            </span>
          ) : null}
        </div>
      </div>

      <PredictionForm
        match={match}
        prediction={prediction}
        draft={draft}
        isAuthenticated={isAuthenticated}
        isAuthLoading={isAuthLoading}
        onEditingChange={onEditingChange}
        onDraftChange={onDraftChange}
        onSave={onSavePrediction}
      />
    </article>
  )
}
