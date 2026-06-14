'use client'

import { useTranslations } from '@/frontend/components/LocaleProvider'
import PredictionForm from '@/frontend/components/prode/PredictionForm'
import type { Match, Prediction } from '@/frontend/types/prode'
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

const DATE_LOCALE: Record<string, string> = {
  es: 'es-AR',
  en: 'en-US',
  pt: 'pt-BR',
  fr: 'fr-FR',
}

function formatDate(value: string | null, locale: string, unscheduledLabel: string) {
  if (!value) return unscheduledLabel

  const date = parseMatchDate(value)
  const dateLocale = DATE_LOCALE[locale] ?? locale
  const weekday = new Intl.DateTimeFormat(dateLocale, {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short',
  }).format(date).replace('.', '')
  const dayMonthParts = new Intl.DateTimeFormat(dateLocale, {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
  }).formatToParts(date)
  const day = dayMonthParts.find((part) => part.type === 'day')?.value.padStart(2, '0') ?? '00'
  const month = dayMonthParts.find((part) => part.type === 'month')?.value.padStart(2, '0') ?? '00'
  const time = new Intl.DateTimeFormat(dateLocale, {
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
  const { locale, t } = useTranslations()
  const predictionPoints = prediction?.points
  const hasPredictionScore =
    prediction?.prediction_score_found ??
    prediction?.predictionScoreFound ??
    (predictionPoints !== null && predictionPoints !== undefined)
  const pointsLabel =
    predictionPoints === 1
      ? `1 ${t('common.pointsAbbr').replace(/s$/i, '')}`
      : `${Number.isFinite(predictionPoints) ? predictionPoints : 0} ${t('common.pointsAbbr')}`

  return (
    <article className="w-full min-w-0 bg-[#07100d]/35 px-3 py-3.5 transition hover:bg-[rgba(112,255,157,0.045)] sm:px-4">
      <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-white">
            {formatDate(match.matchDate, locale, t('common.unscheduled'))}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {prediction && hasPredictionScore ? (
            <span className="hf-badge rounded-full px-2 py-0.5 text-[11px] font-black">
              {pointsLabel}
              {prediction.exactHit
                ? ` ${t('common.exact')}`
                : prediction.partialHit
                  ? ` ${t('common.partial')}`
                  : ''}
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
