'use client'

import type { Match, Prediction } from '@/frontend/types/prode'
import MatchCard from '@/frontend/components/prode/MatchCard'
import {
  getProdeRoundLabel,
  normalizeProdeRound,
} from '@/shared/config/prode-rounds'
import { parseMatchDate } from '@/shared/utils/prediction-lock'

type MatchListProps = {
  matches: Match[]
  predictionsByMatchId: Map<string, Prediction>
  predictionDraftsByMatchId: Map<string, { home: string; away: string }>
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

type MatchGroup = {
  key: string
  label: string
  matches: Match[]
}

function formatGroupDate(value: string | null) {
  if (!value) return 'A programar'

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(parseMatchDate(value))
}

function getGroupLabel(match: Match) {
  const label = getProdeRoundLabel(match.round, match.league?.externalId)

  if (label) return label

  return formatGroupDate(match.matchDate)
}

function getMatchSortTime(match: Match) {
  const timestamp = parseMatchDate(match.matchDate).getTime()

  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER
}

function groupMatches(matches: Match[]): MatchGroup[] {
  const groups = new Map<string, MatchGroup>()

  for (const match of matches) {
    const label = getGroupLabel(match)
    const normalizedRound = normalizeProdeRound(match.round, match.league?.externalId)
    const key = normalizedRound
      ? `round-${normalizedRound}`
      : `date-${match.matchDate?.slice(0, 10) ?? 'a-programar'}`
    const group = groups.get(key)

    if (group) {
      group.matches.push(match)
    } else {
      groups.set(key, {
        key,
        label,
        matches: [match],
      })
    }
  }

  return [...groups.values()].map((group) => ({
    ...group,
    matches: group.matches.sort((a, b) => {
      const dateCompare = getMatchSortTime(a) - getMatchSortTime(b)

      if (dateCompare !== 0) return dateCompare

      return a.id.localeCompare(b.id, 'es-AR', { numeric: true })
    }),
  }))
}

export default function MatchList({
  matches,
  predictionsByMatchId,
  predictionDraftsByMatchId,
  isAuthenticated,
  isAuthLoading,
  onEditingChange,
  onDraftChange,
  onSavePrediction,
}: MatchListProps) {
  const groups = groupMatches(matches)

  if (!matches.length) {
    return (
      <div className="hf-card w-full rounded-2xl p-4">
        <h2 className="text-lg font-black text-white">Partidos</h2>
        <p className="mt-2 text-sm text-[#8d98a7]">
          No hay partidos cargados para los filtros seleccionados.
        </p>
      </div>
    )
  }

  return (
    <section className="w-full min-w-0 space-y-3">
      {groups.map((group) => (
        <div key={group.key} className="hf-card w-full min-w-0 overflow-hidden rounded-2xl">
          <div className="hf-section-head px-3 py-2 sm:px-4">
            <h3 className="text-sm font-black text-white">
              {group.label}
            </h3>
          </div>
          <div className="divide-y divide-white/6">
            {group.matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={predictionsByMatchId.get(match.id)}
                draft={predictionDraftsByMatchId.get(match.id)}
                isAuthenticated={isAuthenticated}
                isAuthLoading={isAuthLoading}
                onEditingChange={onEditingChange}
                onDraftChange={onDraftChange}
                onSavePrediction={onSavePrediction}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
