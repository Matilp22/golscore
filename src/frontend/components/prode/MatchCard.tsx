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
  const date = parseMatchDate(value)
  const weekday = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short',
  }).format(date).replace('.', '')
  const dayMonthParts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
  }).formatToParts(date)
  const day = dayMonthParts.find((part) => part.type === 'day')?.value.padStart(2, '0') ?? '00'
  const month = dayMonthParts.find((part) => part.type === 'month')?.value.padStart(2, '0') ?? '00'
  const time = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

  return `${weekday} ${day}-${month} \u00b7 ${time}`
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
  const predictionPoints = prediction?.points
  const hasPredictionScore =
    prediction?.prediction_score_found ??
    prediction?.predictionScoreFound ??
    (predictionPoints !== null && predictionPoints !== undefined)
  const pointsLabel =
    predictionPoints === 1 ? '1 pt' : `${Number.isFinite(predictionPoints) ? predictionPoints : 0} pts`

  return (
    <article className="w-full min-w-0 px-3 py-3.5 sm:px-4">
      <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-white">
            {formatDate(match.matchDate)}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {prediction && hasPredictionScore ? (
            <span className="rounded-full border border-[#25553d]/70 bg-[#13251d]/80 px-2 py-0.5 text-[11px] font-bold text-[#7ff0b2]">
              {pointsLabel}
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
