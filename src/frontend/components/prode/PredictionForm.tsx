'use client'

import { useMemo, useState, useTransition } from 'react'
import type { Match, Prediction } from '@/frontend/types/prode'
import { isPredictionLocked } from '@/frontend/types/prode'

type PredictionFormProps = {
  match: Match
  prediction?: Prediction
  isAuthenticated: boolean
  isAuthLoading: boolean
  onEditingChange?: (matchId: string, isEditing: boolean) => void
  onSave: (input: {
    matchId: string
    predictedHomeScore: number
    predictedAwayScore: number
  }) => Promise<void>
}

function toScoreInputValue(value: number | null | undefined) {
  return Number.isFinite(value) ? String(value) : ''
}

export default function PredictionForm({
  match,
  prediction,
  isAuthenticated,
  isAuthLoading,
  onEditingChange,
  onSave,
}: PredictionFormProps) {
  const hasExistingPrediction = Boolean(prediction)
  const [home, setHome] = useState(
    prediction ? toScoreInputValue(prediction.predictedHomeScore) : ''
  )
  const [away, setAway] = useState(
    prediction ? toScoreInputValue(prediction.predictedAwayScore) : ''
  )
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(!hasExistingPrediction)
  const locked = isPredictionLocked(match.matchDate)
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

  const handleSave = () => {
    setMessage('')

    if (hasExistingPrediction && !isEditing) {
      setIsEditing(true)
      onEditingChange?.(match.id, true)
      return
    }

    if (!isAuthenticated) {
      setMessage('Inicia sesion para guardar tu prediccion.')
      return
    }

    if (locked) {
      setMessage('La prediccion esta bloqueada para este partido.')
      return
    }

    if (
      !Number.isInteger(predictedHomeScore) ||
      !Number.isInteger(predictedAwayScore) ||
      predictedHomeScore < 0 ||
      predictedAwayScore < 0
    ) {
      setMessage('Ingresa dos marcadores validos.')
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
        setMessage('Prediccion guardada.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo guardar.')
      }
    })
  }

  return (
    <div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_56px_56px_minmax(0,1fr)] items-center gap-2 md:grid-cols-[minmax(140px,1fr)_64px_28px_64px_minmax(140px,1fr)_112px] md:gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-black leading-tight text-white md:truncate">
            {match.homeTeam?.name ?? 'Local'}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8d98a7]">
            Local
          </p>
        </div>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          disabled={inputsDisabled}
          value={home}
          onChange={(event) => {
            onEditingChange?.(match.id, true)
            setHome(event.target.value)
            if (message) setMessage('')
          }}
          aria-label="Pronostico local"
          className="h-12 w-full min-w-0 rounded-xl border border-white/8 bg-[#0f1317] text-center text-base font-black text-white outline-none focus:border-[#25553d] disabled:opacity-45 md:h-11"
        />
        <span className="hidden text-center text-sm font-black text-[#8d98a7] md:block">vs</span>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          disabled={inputsDisabled}
          value={away}
          onChange={(event) => {
            onEditingChange?.(match.id, true)
            setAway(event.target.value)
            if (message) setMessage('')
          }}
          aria-label="Pronostico visitante"
          className="h-12 w-full min-w-0 rounded-xl border border-white/8 bg-[#0f1317] text-center text-base font-black text-white outline-none focus:border-[#25553d] disabled:opacity-45 md:h-11"
        />
        <div className="min-w-0 text-right">
          <p className="break-words text-sm font-black leading-tight text-white md:truncate">
            {match.awayTeam?.name ?? 'Visitante'}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8d98a7]">
            Visitante
          </p>
        </div>
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
          Verificando sesion...
        </p>
      ) : null}
      {message ? (
        <p className="mt-2 text-xs font-semibold text-[#dce7f2]">{message}</p>
      ) : null}
    </div>
  )
}
