'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState, useTransition } from 'react'
import type { Match, Prediction } from '@/frontend/types/prode'
import { getMatchPredictionLockState } from '@/frontend/types/prode'
import { isFinalMatchStatus, isLiveStatus } from '@/shared/utils/match-status'

type PredictionFormProps = {
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
  onSave: (input: {
    matchId: string
    predictedHomeScore: number
    predictedAwayScore: number
  }) => Promise<void>
}

function toScoreInputValue(value: number | null | undefined) {
  return Number.isFinite(value) ? String(value) : ''
}

function TeamLogo({
  logoUrl,
  name,
}: {
  logoUrl?: string | null
  name: string
}) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.03]">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={name}
          width={32}
          height={32}
          className="h-7 w-7 object-contain"
        />
      ) : (
        <span
          aria-hidden="true"
          className="h-5 w-4 bg-[#8d98a7]"
          style={{ clipPath: 'polygon(50% 0, 92% 16%, 84% 72%, 50% 100%, 16% 72%, 8% 16%)' }}
        />
      )}
    </span>
  )
}

function TeamLabel({
  align = 'left',
  className = '',
  logoUrl,
  name,
  role,
}: {
  align?: 'left' | 'right'
  className?: string
  logoUrl?: string | null
  name: string
  role: string
}) {
  const content = (
    <>
      <TeamLogo logoUrl={logoUrl} name={name} />
      <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
        <p className="break-words text-sm font-bold leading-tight text-white md:truncate">
          {name}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8d98a7]">
          {role}
        </p>
      </div>
    </>
  )

  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'justify-end' : ''} ${className}`}
    >
      {align === 'right' ? (
        <>
          <div className="min-w-0 text-right">
            <p className="break-words text-sm font-bold leading-tight text-white md:truncate">
              {name}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8d98a7]">
              {role}
            </p>
          </div>
          <TeamLogo logoUrl={logoUrl} name={name} />
        </>
      ) : (
        content
      )}
    </div>
  )
}

export default function PredictionForm({
  match,
  prediction,
  draft,
  isAuthenticated,
  isAuthLoading,
  onEditingChange,
  onDraftChange,
  onSave,
}: PredictionFormProps) {
  const hasExistingPrediction = Boolean(prediction)
  const [home, setHome] = useState(
    draft?.home ?? (prediction ? toScoreInputValue(prediction.predictedHomeScore) : '')
  )
  const [away, setAway] = useState(
    draft?.away ?? (prediction ? toScoreInputValue(prediction.predictedAwayScore) : '')
  )
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(!hasExistingPrediction)
  const lockState = useMemo(() => getMatchPredictionLockState(match), [match])
  const locked = lockState.locked
  const actionLabel =
    locked ? 'Bloqueado' : hasExistingPrediction && !isEditing ? 'Editar' : 'Guardar'
  const predictedHomeScore = home.trim() === '' ? NaN : Number(home)
  const predictedAwayScore = away.trim() === '' ? NaN : Number(away)
  const hasValidScores = useMemo(
    () =>
      Number.isInteger(predictedHomeScore) &&
      Number.isInteger(predictedAwayScore) &&
      predictedHomeScore >= 0 &&
      predictedAwayScore >= 0,
    [predictedAwayScore, predictedHomeScore]
  )
  const inputsDisabled = locked || isPending || isAuthLoading || (hasExistingPrediction && !isEditing)
  const canEnterEditMode = hasExistingPrediction && !isEditing && !locked && !isPending && !isAuthLoading
  const canSavePrediction =
    !locked &&
    !isPending &&
    !isAuthLoading &&
    isAuthenticated &&
    (!hasExistingPrediction || isEditing) &&
    hasValidScores
  const buttonDisabled = canEnterEditMode ? false : !canSavePrediction
  const hasRealScore = match.homeScore !== null && match.awayScore !== null
  const realScoreStatus = isFinalMatchStatus(match.status)
    ? 'Final'
    : isLiveStatus(match.status)
      ? 'En vivo'
      : 'Real'
  const predictionGridClass =
    'grid min-w-0 grid-cols-[minmax(0,1fr)_48px_48px_minmax(0,1fr)] items-center gap-2 md:grid-cols-[minmax(140px,1fr)_58px_24px_58px_minmax(140px,1fr)_104px] md:gap-3'

  useEffect(() => {
    console.debug('[prode/prediction-form] lock check', {
      matchId: match.id,
      match_date: match.matchDate,
      status: match.status,
      now: lockState.now.toISOString(),
      matchStart: lockState.matchStart.toISOString(),
      lockAt: lockState.lockAt.toISOString(),
      minutesUntilMatch: Math.round(lockState.minutesUntilMatch * 10) / 10,
      locked,
    })
  }, [locked, lockState, match.id, match.matchDate, match.status])

  const handleSave = () => {
    setMessage('')

    if (hasExistingPrediction && !isEditing) {
      setIsEditing(true)
      onEditingChange?.(match.id, true)
      return
    }

    if (!isAuthenticated) {
      setMessage('Iniciá sesión para guardar tu predicción.')
      return
    }

    if (locked) {
      setMessage('La predicción está bloqueada para este partido.')
      return
    }

    if (
      !Number.isInteger(predictedHomeScore) ||
      !Number.isInteger(predictedAwayScore) ||
      predictedHomeScore < 0 ||
      predictedAwayScore < 0
    ) {
      setMessage('Ingresá dos marcadores válidos.')
      return
    }

    startTransition(async () => {
      try {
        await onSave({
          matchId: match.id,
          predictedHomeScore,
          predictedAwayScore,
        })
        setIsEditing(false)
        onEditingChange?.(match.id, false)
        setMessage('Predicción guardada.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo guardar.')
      }
    })
  }

  return (
    <div>
      {hasRealScore ? (
        <div className={`${predictionGridClass} mb-1`}>
          <div className="col-start-2 col-span-2 justify-self-center text-center md:col-start-2 md:col-span-3">
            <div
              className="inline-flex flex-col items-center gap-0.5 text-center leading-none text-[#aab5c1]"
            >
              <span
                className={`text-[10px] font-semibold ${
                  isLiveStatus(match.status) ? 'text-[#7ff0b2]' : 'text-[#8d98a7]'
                }`}
              >
                {realScoreStatus}
              </span>
              <span className="text-xs font-black text-white">
                {match.homeScore} - {match.awayScore}
              </span>
            </div>
          </div>
        </div>
      ) : null}
      <div className={predictionGridClass}>
        <TeamLabel
          className="col-start-1"
          name={match.homeTeam?.name ?? 'Local'}
          logoUrl={match.homeTeam?.logoUrl}
          role="Local"
        />
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          disabled={inputsDisabled}
          value={home}
          onFocus={() => onEditingChange?.(match.id, true)}
          onChange={(event) => {
            const nextHome = event.target.value
            onEditingChange?.(match.id, true)
            setHome(nextHome)
            onDraftChange?.(match.id, { home: nextHome, away })
            if (message) setMessage('')
          }}
          aria-label="Pronóstico local"
          className="h-11 w-full min-w-0 rounded-xl border border-white/10 bg-[#e8eef4] text-center text-base font-black text-[#0b1115] outline-none transition focus:border-[#7ff0b2] focus:ring-2 focus:ring-[#7ff0b2]/20 disabled:bg-[#26303a] disabled:text-[#9aa7b5] disabled:opacity-80"
        />
        <span className="hidden text-center text-xs font-black uppercase text-[#8d98a7] md:block">vs</span>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          disabled={inputsDisabled}
          value={away}
          onFocus={() => onEditingChange?.(match.id, true)}
          onChange={(event) => {
            const nextAway = event.target.value
            onEditingChange?.(match.id, true)
            setAway(nextAway)
            onDraftChange?.(match.id, { home, away: nextAway })
            if (message) setMessage('')
          }}
          aria-label="Pronóstico visitante"
          className="h-11 w-full min-w-0 rounded-xl border border-white/10 bg-[#e8eef4] text-center text-base font-black text-[#0b1115] outline-none transition focus:border-[#7ff0b2] focus:ring-2 focus:ring-[#7ff0b2]/20 disabled:bg-[#26303a] disabled:text-[#9aa7b5] disabled:opacity-80"
        />
        <TeamLabel
          align="right"
          name={match.awayTeam?.name ?? 'Visitante'}
          logoUrl={match.awayTeam?.logoUrl}
          role="Visitante"
        />
        <button
          type="button"
          disabled={buttonDisabled}
          onClick={handleSave}
          className="col-span-4 h-11 rounded-xl border border-[#25553d] bg-[#163828] px-4 text-sm font-bold text-[#7ff0b2] transition hover:bg-[#1b4330] disabled:cursor-not-allowed disabled:opacity-45 md:col-span-1"
        >
          {isPending ? 'Guardando' : actionLabel}
        </button>
      </div>
      {isAuthLoading ? (
        <p className="mt-2 text-xs font-semibold text-[#8d98a7]">
          Verificando sesión...
        </p>
      ) : null}
      {message ? (
        <p className="mt-2 text-xs font-semibold text-[#dce7f2]">{message}</p>
      ) : null}
    </div>
  )
}
