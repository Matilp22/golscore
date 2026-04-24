'use client'

import type { Match, Prediction } from '@/frontend/types/prode'
import MatchCard from '@/frontend/components/prode/MatchCard'
import {
  getProdeRoundLabel,
  normalizeProdeRound,
} from '@/shared/config/prode-rounds'

type MatchListProps = {
  matches: Match[]
  predictionsByMatchId: Map<string, Prediction>
  isAuthenticated: boolean
  isAuthLoading: boolean
  onEditingChange?: (matchId: string, isEditing: boolean) => void
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

function formatGroupDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date(value))
}

function getGroupLabel(match: Match) {
  const label = getProdeRoundLabel(match.round, match.league?.externalId)

  if (label) return label

  return formatGroupDate(match.matchDate)
}

function groupMatches(matches: Match[]): MatchGroup[] {
  const groups = new Map<string, MatchGroup>()

  for (const match of matches) {
    const label = getGroupLabel(match)
    const normalizedRound = normalizeProdeRound(match.round, match.league?.externalId)
    const key = normalizedRound
      ? `round-${normalizedRound}`
      : `date-${match.matchDate.slice(0, 10)}`
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
    matches: group.matches.sort(
      (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()
    ),
  }))
}

export default function MatchList({
  matches,
  predictionsByMatchId,
  isAuthenticated,
  isAuthLoading,
  onEditingChange,
  onSavePrediction,
}: MatchListProps) {
  const groups = groupMatches(matches)

  if (!matches.length) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#111418] p-6">
        <h2 className="text-lg font-black text-white">Partidos</h2>
        <p className="mt-2 text-sm text-[#8d98a7]">
          No hay partidos cargados para los filtros seleccionados.
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-3">
      {groups.map((group) => (
        <div key={group.key} className="overflow-hidden rounded-2xl border border-white/8 bg-[#111418]">
          <div className="border-b border-white/8 bg-[#151a20] px-4 py-3">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-white">
              {group.label}
            </h3>
          </div>
          <div className="divide-y divide-white/6">
            {group.matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={predictionsByMatchId.get(match.id)}
                isAuthenticated={isAuthenticated}
                isAuthLoading={isAuthLoading}
                onEditingChange={onEditingChange}
                onSavePrediction={onSavePrediction}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
