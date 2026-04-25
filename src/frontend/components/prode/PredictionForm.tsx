'use client'

import Image from 'next/image'
import { useMemo, useState, useTransition } from 'react'
import type { Match, Prediction } from '@/frontend/types/prode'
import { isPredictionLocked } from '@/frontend/types/prode'

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

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function TeamLogo({
  logoUrl,
  name,
}: {
  logoUrl?: string | null
  name: string
}) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/8 bg-[#151b21] text-[10px] font-black text-[#7ff0b2]">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={name}
          width={32}
          height={32}
          className="h-7 w-7 object-contain"
        />
      ) : (
        getInitials(name)
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
          onFocus={() => onEditingChange?.(match.id, true)}
          onChange={(event) => {
            const nextAway = event.target.value
            onEditingChange?.(match.id, true)
            setAway(nextAway)
            onDraftChange?.(match.id, { home, away: nextAway })
            if (message) setMessage('')
          }}
          aria-label="Pronóstico visitante"
          className="h-12 w-full min-w-0 rounded-xl border border-white/8 bg-[#0f1317] text-center text-base font-black text-white outline-none focus:border-[#25553d] disabled:opacity-45 md:h-11"
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
