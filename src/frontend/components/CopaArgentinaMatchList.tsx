'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { TeamLogo } from '@/frontend/components/AssetImage'
import type { LeagueFixtureSummary } from '@/lib/api-football'
import { formatMatchScoreWithPenalties } from '@/shared/utils/match-display'
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

function formatDate(date: string | null) {
  if (!date) return 'Fecha a confirmar'

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

function getScoreLabel(match: LeagueFixtureSummary) {
  if (match.goalsHome === null && match.goalsAway === null) return 'vs'

  return formatMatchScoreWithPenalties({
    goalsHome: match.goalsHome,
    goalsAway: match.goalsAway,
    homePenaltyScore: match.homePenaltyScore,
    awayPenaltyScore: match.awayPenaltyScore,
  })
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
    <div className="hf-copa-agenda">
      <div className="hf-copa-agenda-toolbar">
        <label htmlFor="copa-argentina-round">
          Fase
        </label>
        <select
          id="copa-argentina-round"
          value={activeRound.label}
          onChange={(event) => setSelectedRound(event.target.value)}
          className="hf-copa-agenda-select"
        >
          {availableRounds.map((round) => (
            <option key={round.label} value={round.label}>
              {round.label}
            </option>
          ))}
        </select>
      </div>

      <div className="hf-copa-agenda-list">
        {activeRound.matches.map((match) => (
          <Link
            key={match.id}
            href={`/partido/${match.id}`}
            className="hf-copa-agenda-match"
          >
            <div className="hf-copa-agenda-date">{formatDate(match.date)}</div>

            <div className="hf-copa-agenda-teams">
              <div className="hf-copa-agenda-team is-home">
                <span>{match.home}</span>
                <TeamLogo
                  src={match.homeLogo}
                  alt={match.home}
                  size={16}
                  className="h-4 w-4 object-contain"
                  fallbackClassName="h-3.5 w-3"
                />
              </div>

              <div className="hf-copa-agenda-score">{getScoreLabel(match)}</div>

              <div className="hf-copa-agenda-team is-away">
                <TeamLogo
                  src={match.awayLogo}
                  alt={match.away}
                  size={16}
                  className="h-4 w-4 object-contain"
                  fallbackClassName="h-3.5 w-3"
                />
                <span>{match.away}</span>
              </div>
            </div>

            <div className="hf-copa-agenda-status">{getStatusLabel(match)}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
