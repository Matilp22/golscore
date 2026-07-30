'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import type { LeaderStatType, PlayerEventMatch } from '@/lib/api-football'
import { formatEventMinute } from '@/shared/utils/event-minute'
import { formatMatchScoreWithPenalties } from '@/shared/utils/match-display'

type PlayerIncidentsListProps = {
  leagueId?: number
  season?: number
  playerId: number
  playerName: string
  teamId?: number
  expectedCount?: number
  tournamentName?: string
  statType: LeaderStatType
}

const statTypeLabels: Record<LeaderStatType, string> = {
  scorers: 'goles',
  assists: 'asistencias',
  yellowCards: 'tarjetas amarillas',
  redCards: 'tarjetas rojas',
}

function normalizeRoundName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function translateRoundName(value: string, tournamentName?: string) {
  const normalized = normalizeRoundName(value)

  if (normalized.includes('regular season')) return tournamentName || 'Temporada regular'
  if (
    normalized.includes('third place') ||
    normalized.includes('3rd place') ||
    normalized.includes('tercer puesto')
  ) {
    return 'Tercer puesto'
  }
  if (normalized.includes('final') && !normalized.includes('semi')) return 'Final'
  if (normalized.includes('semi')) return 'Semifinales'
  if (normalized.includes('quarter')) return 'Cuartos de final'
  if (normalized.includes('octavos') || normalized.includes('round of 16')) {
    return 'Octavos de final'
  }
  if (normalized.includes('16th finals') || normalized.includes('dieciseisavos')) {
    return 'Dieciseisavos'
  }
  if (normalized.includes('32nd finals') || normalized.includes('treintaidosavos')) {
    return 'Treintaidosavos'
  }
  if (normalized.includes('group') || normalized.includes('grupo')) {
    const match = normalized.match(/\b(?:group|grupo)\s+([a-z0-9]+)\b/)
    if (match) return `Grupo ${match[1].toUpperCase()}`
  }

  return value
}

function formatDate(value?: string) {
  if (!value) return 'No disponible'

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export default function PlayerIncidentsList({
  leagueId,
  season,
  playerId,
  playerName,
  teamId,
  expectedCount,
  tournamentName,
  statType,
}: PlayerIncidentsListProps) {
  const [loading, setLoading] = useState(Boolean(leagueId && season))
  const [error, setError] = useState<string | null>(null)
  const [matches, setMatches] = useState<PlayerEventMatch[]>([])

  useEffect(() => {
    if (!leagueId || !season) {
      setLoading(false)
      setMatches([])
      return
    }

    let active = true

    async function loadMatches() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/leader-events?leagueId=${leagueId}&season=${season}&playerId=${playerId}&statType=${statType}&playerName=${encodeURIComponent(playerName)}&teamId=${teamId || ''}&expectedCount=${expectedCount || ''}`,
          { cache: 'no-store' }
        )
        const data = (await response.json()) as {
          error?: string
          matches?: PlayerEventMatch[]
        }

        if (!response.ok) {
          throw new Error(data.error || 'No se pudieron cargar las incidencias.')
        }
        if (active) setMatches(data.matches || [])
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No se pudieron cargar las incidencias.'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadMatches()

    return () => {
      active = false
    }
  }, [leagueId, season, playerId, playerName, teamId, expectedCount, statType])

  return (
    <section className="hf-entity-panel hf-player-incidents">
      <header className="hf-entity-panel-heading">
        <div>
          <p className="hf-type-overline">Incidencias</p>
          <h2>Partidos con registro</h2>
          <p>Encuentros donde registró {statTypeLabels[statType]}.</p>
        </div>
        <span>{matches.length} partidos</span>
      </header>

      {loading ? (
        <div className="hf-entity-loading" role="status">
          <span className="hf-spinner" aria-hidden="true" />
          Buscando incidencias del jugador…
        </div>
      ) : error ? (
        <div className="hf-state-inline is-error" role="alert">
          <strong>No pudimos cargar las incidencias</strong>
          <p>{error}</p>
        </div>
      ) : matches.length ? (
        <div className="hf-player-incident-list">
          {matches.map((match) => (
            <Link
              key={match.fixtureId}
              href={`/partido/${match.fixtureId}`}
              className="hf-player-incident"
            >
              <div className="hf-player-incident-head">
                <div>
                  <p className="hf-type-overline">
                    {translateRoundName(match.round, tournamentName)}
                  </p>
                  <strong>
                    {match.home}{' '}
                    {formatMatchScoreWithPenalties({
                      goalsHome: match.goalsHome,
                      goalsAway: match.goalsAway,
                      homePenaltyScore: match.homePenaltyScore,
                      awayPenaltyScore: match.awayPenaltyScore,
                    })}{' '}
                    {match.away}
                  </strong>
                </div>
                <time>{formatDate(match.date)}</time>
              </div>

              <div className="hf-player-incident-events">
                {match.events.map((event, index) => (
                  <span key={`${match.fixtureId}-${index}`}>
                    {event.label}
                    {event.minute !== null && event.minute !== undefined
                      ? ` ${formatEventMinute(event.minute, event.extraMinute)}`
                      : ''}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="hf-competition-empty">
          No se encontraron partidos con ese registro en este torneo.
        </div>
      )}
    </section>
  )
}
