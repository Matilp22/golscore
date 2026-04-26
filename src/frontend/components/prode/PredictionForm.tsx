'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState, useTransition } from 'react'
import type { Match, Prediction } from '@/frontend/types/prode'
import { getMatchPredictionLockState } from '@/frontend/types/prode'

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
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden">
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
  logoUrl,
  name,
  role,
}: {
  align?: 'left' | 'right'
  logoUrl?: string | null
  name: string
  role: string
}) {
  const content = (
    <>
      <TeamLogo logoUrl={logoUrl} name={name} />
      <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
        <p className="break-words text-sm font-black leading-tight text-white md:truncate">
          {name}
        </p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8d98a7]">
          {role}
        </p>
      </div>
    </>
  )

  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
      {align === 'right' ? (
        <>
          <div className="min-w-0 text-right">
            <p className="break-words text-sm font-black leading-tight text-white md:truncate">
              {name}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8d98a7]">
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
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_56px_56px_minmax(0,1fr)] items-center gap-2 md:grid-cols-[minmax(140px,1fr)_64px_28px_64px_minmax(140px,1fr)_112px] md:gap-3">
        <TeamLabel
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
          className="h-12 w-full min-w-0 rounded-xl border border-[#c9d1d9] bg-white text-center text-base font-black text-black outline-none focus:border-[#7ff0b2] disabled:bg-[#d8dde3] disabled:text-[#1f2933] disabled:opacity-75 md:h-11"
        />
        <span className="hidden text-center text-sm font-black text-[#8d98a7] md:block">vs</span>
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
          className="h-12 w-full min-w-0 rounded-xl border border-[#c9d1d9] bg-white text-center text-base font-black text-black outline-none focus:border-[#7ff0b2] disabled:bg-[#d8dde3] disabled:text-[#1f2933] disabled:opacity-75 md:h-11"
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
          className="col-span-4 h-12 rounded-xl border border-[#25553d] bg-[#163828] px-4 text-sm font-bold text-[#7ff0b2] transition hover:bg-[#1b4330] disabled:cursor-not-allowed disabled:opacity-45 md:col-span-1 md:h-11"
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
