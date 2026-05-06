'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { TeamLogo } from '@/frontend/components/AssetImage'
import type { LeagueFixtureSummary } from '@/lib/api-football'
import { parseMatchDate } from '@/shared/utils/prediction-lock'

type CopaArgentinaMatchListProps = {
  rounds: Array<{
    round: string
    label: string
    matches: LeagueFixtureSummary[]
  }>
  initialRoundLabel?: string
}

const ROUND_ORDER = [
  '32AVOS DE FINAL',
  '16AVOS DE FINAL',
  'OCTAVOS DE FINAL',
  'CUARTOS DE FINAL',
  'SEMIFINALES',
  'FINAL',
]

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(parseMatchDate(date))
}

function hasPenaltyScore(match: LeagueFixtureSummary) {
  return (
    match.homePenaltyScore !== null &&
    match.homePenaltyScore !== undefined &&
    match.awayPenaltyScore !== null &&
    match.awayPenaltyScore !== undefined
  )
}

function getScoreLabel(match: LeagueFixtureSummary) {
  if (match.goalsHome === null && match.goalsAway === null) return 'vs'
  if (hasPenaltyScore(match)) {
    return `${match.goalsHome ?? '-'} (${match.homePenaltyScore}) - ${match.goalsAway ?? '-'} (${match.awayPenaltyScore})`
  }

  return `${match.goalsHome ?? '-'} - ${match.goalsAway ?? '-'}`
}

function getStatusLabel(match: LeagueFixtureSummary) {
  if (match.statusShort === 'NS') return 'Programado'
  if (match.statusShort === 'FT') return 'Final'
  if (['1H', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(match.statusShort)) {
    return match.minute ? `${match.minute}'` : 'En vivo'
  }

  return match.statusShort
}

export default function CopaArgentinaMatchList({
  rounds,
  initialRoundLabel,
}: CopaArgentinaMatchListProps) {
  const availableRounds = useMemo(
    () =>
      ROUND_ORDER.map((label) => rounds.find((round) => round.label === label))
        .filter((round): round is CopaArgentinaMatchListProps['rounds'][number] => Boolean(round)),
    [rounds]
  )
  const [selectedRound, setSelectedRound] = useState(
    initialRoundLabel || availableRounds[0]?.label || ''
  )
  const activeRound =
    availableRounds.find((round) => round.label === selectedRound) || availableRounds[0]

  if (!activeRound) return null

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-xs font-semibold text-[#dce5ef]" htmlFor="copa-argentina-round">
          Fase
        </label>
        <select
          id="copa-argentina-round"
          value={activeRound.label}
          onChange={(event) => setSelectedRound(event.target.value)}
          className="min-h-8 rounded-xl border border-white/8 bg-[#10151a] px-2.5 py-1.5 text-xs font-semibold text-white outline-none transition hover:border-white/12 focus:border-[#7ff0b2]/70"
        >
          {availableRounds.map((round) => (
            <option key={round.label} value={round.label} className="bg-[#10151a] text-white">
              {round.label}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-white/8 bg-[#11161b]">
        {activeRound.matches.map((match) => (
          <Link
            key={match.id}
            href={`/partido/${match.id}`}
            className="grid gap-1.5 border-b border-white/8 px-2 py-1.5 text-xs transition hover:bg-[#151b21] focus-visible:bg-[#151b21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ff0b2]/60 focus-visible:ring-inset last:border-b-0 md:grid-cols-[112px_minmax(0,1fr)_80px] md:gap-2 md:px-3"
          >
            <div className="font-semibold text-[#8fa0b1]">{formatDate(match.date)}</div>

            <div className="grid grid-cols-[minmax(0,1fr)_76px_minmax(0,1fr)] items-center gap-1.5">
              <div className="flex min-w-0 items-center justify-end gap-1.5 text-right">
                <span className="truncate font-semibold text-[#dce5ef]">{match.home}</span>
                <TeamLogo
                  src={match.homeLogo}
                  alt={match.home}
                  size={16}
                  className="h-4 w-4 object-contain"
                  fallbackClassName="h-3.5 w-3"
                />
              </div>

              <div className="text-center text-[13px] font-black text-white">{getScoreLabel(match)}</div>

              <div className="flex min-w-0 items-center gap-1.5">
                <TeamLogo
                  src={match.awayLogo}
                  alt={match.away}
                  size={16}
                  className="h-4 w-4 object-contain"
                  fallbackClassName="h-3.5 w-3"
                />
                <span className="truncate font-semibold text-[#dce5ef]">{match.away}</span>
              </div>
            </div>

            <div className="font-bold text-[#7ff0b2] md:text-right">{getStatusLabel(match)}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
