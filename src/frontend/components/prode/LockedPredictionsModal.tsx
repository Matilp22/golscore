'use client'

import { useEffect, useId } from 'react'

export type LockedPredictionModalItem = {
  predictionId: string
  matchDate: string
  homeTeamName: string
  awayTeamName: string
  homeLogoUrl: string | null
  awayLogoUrl: string | null
  predictedHomeScore: number
  predictedAwayScore: number
  realHomeScore: number | null | undefined
  realAwayScore: number | null | undefined
  points: number | null
  exactHit: boolean
  partialHit: boolean
  scoreCalculated: boolean
}

export type LockedPredictionsModalLabels = {
  title: string
  hint: string
  noPredictions: string
  prediction: string
  result: string
  pendingScore: string
  points: string
  close: string
  matchPoints: (points: number) => string
}

type LockedPredictionsModalProps = {
  userName: string
  totalPoints: number
  predictions: LockedPredictionModalItem[]
  labels: LockedPredictionsModalLabels
  locale: string
  onClose: () => void
}

const DATE_LOCALE: Record<string, string> = {
  es: 'es-AR',
  en: 'en-US',
  pt: 'pt-BR',
  fr: 'fr-FR',
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? locale, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function formatResult(prediction: LockedPredictionModalItem) {
  if (prediction.realHomeScore === null || prediction.realHomeScore === undefined) return null
  if (prediction.realAwayScore === null || prediction.realAwayScore === undefined) return null

  return `${prediction.realHomeScore} - ${prediction.realAwayScore}`
}

function TeamBadge({
  name,
  logoUrl,
  align = 'left',
}: {
  name: string
  logoUrl: string | null
  align?: 'left' | 'right'
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        align === 'right' ? 'justify-end text-right' : ''
      }`}
    >
      {align === 'right' ? null : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/8">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
          ) : null}
        </span>
      )}
      <span className="min-w-0 truncate text-xs font-black text-white sm:text-sm">{name}</span>
      {align === 'right' ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/8">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
          ) : null}
        </span>
      ) : null}
    </div>
  )
}

export default function LockedPredictionsModal({
  userName,
  totalPoints,
  predictions,
  labels,
  locale,
  onClose,
}: LockedPredictionsModalProps) {
  const titleId = useId()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-3 py-4 sm:items-center">
      <button
        type="button"
        aria-label={labels.close}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="hf-card relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="hf-section-head shrink-0 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[#7ff0b2]">
                {labels.title}
              </p>
              <h2 id={titleId} className="mt-1 truncate text-lg font-black text-white">
                {userName}
              </h2>
              <p className="mt-0.5 text-xs text-[#8d98a7]">{labels.hint}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full border border-[#70ff9d]/20 bg-[#70ff9d]/10 px-2 py-1 text-xs font-black text-[#70ff9d]">
                {totalPoints} {labels.points}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="hf-button-secondary h-9 rounded-xl px-3 text-xs font-black"
              >
                {labels.close}
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-black/[0.18] p-3 sm:p-4">
          {predictions.length ? (
            <div className="grid gap-2">
              {predictions.map((prediction) => {
                const realResult = formatResult(prediction)
                const pointsTone = prediction.exactHit
                  ? 'border-[#7ff0b2]/25 bg-[#7ff0b2]/[0.12] text-[#7ff0b2]'
                  : prediction.partialHit
                    ? 'border-amber-300/25 bg-amber-300/[0.12] text-amber-200'
                    : prediction.scoreCalculated
                      ? 'border-white/10 bg-white/[0.04] text-[#dce7f2]'
                      : 'border-white/8 bg-black/25 text-[#9aa7b5]'

                return (
                  <article
                    key={prediction.predictionId}
                    className="rounded-xl border border-white/8 bg-white/[0.025] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#8d98a7]">
                      <span>{formatDate(prediction.matchDate, locale)}</span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 ${pointsTone}`}>
                        {prediction.scoreCalculated
                          ? labels.matchPoints(prediction.points ?? 0)
                          : labels.pendingScore}
                      </span>
                    </div>

                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                      <TeamBadge name={prediction.homeTeamName} logoUrl={prediction.homeLogoUrl} />
                      <span className="rounded-lg border border-white/8 bg-black/25 px-2 py-1 text-sm font-black text-white">
                        {prediction.predictedHomeScore} - {prediction.predictedAwayScore}
                      </span>
                      <TeamBadge
                        name={prediction.awayTeamName}
                        logoUrl={prediction.awayLogoUrl}
                        align="right"
                      />
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-white/6 bg-black/20 px-2 py-1.5">
                        <p className="font-bold uppercase tracking-[0.05em] text-[#8d98a7]">
                          {labels.prediction}
                        </p>
                        <p className="mt-0.5 font-black text-white">
                          {prediction.predictedHomeScore} - {prediction.predictedAwayScore}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/6 bg-black/20 px-2 py-1.5">
                        <p className="font-bold uppercase tracking-[0.05em] text-[#8d98a7]">
                          {labels.result}
                        </p>
                        <p className="mt-0.5 font-black text-white">
                          {realResult ?? labels.pendingScore}
                        </p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-4 text-sm text-[#9aa7b5]">
              {labels.noPredictions}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
