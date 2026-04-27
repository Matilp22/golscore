'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import type { LeaderStatType, PlayerEventMatch } from '@/lib/api-football'

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

  if (normalized.includes('regular season')) {
    return tournamentName || 'Temporada regular'
  }

  if (normalized.includes('third place') || normalized.includes('3rd place') || normalized.includes('tercer puesto')) {
    return 'Tercer puesto'
  }
  if (normalized.includes('final') && !normalized.includes('semi')) return 'Final'
  if (normalized.includes('semi')) return 'Semifinales'
  if (normalized.includes('quarter')) return 'Cuartos de final'
  if (normalized.includes('octavos') || normalized.includes('round of 16')) return 'Octavos de final'
  if (normalized.includes('16th finals') || normalized.includes('dieciseisavos')) return 'Dieciseisavos'
  if (normalized.includes('32nd finals') || normalized.includes('treintaidosavos')) return 'Treintaidosavos'
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

        if (!active) return

        setMatches(data.matches || [])
      } catch (err) {
        if (!active) return

        setError(
          err instanceof Error ? err.message : 'No se pudieron cargar las incidencias.'
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadMatches()

    return () => {
      active = false
    }
  }, [leagueId, season, playerId, playerName, teamId, expectedCount, statType])

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0f1317]/92">
      <div className="border-b border-white/6 bg-[#13181d] px-2 py-3 md:px-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Partidos con incidencias</h2>
            <p className="mt-1 text-sm text-[#8d98a7]">
              Encuentros donde registró {statTypeLabels[statType]}.
            </p>
          </div>
          <span className="text-[11px] uppercase tracking-[0.16em] text-[#8d98a7]">
            {matches.length} partidos
          </span>
        </div>
      </div>

      {loading ? (
        <div className="px-2 py-5 text-sm text-[#8d98a7] md:px-4">Buscando incidencias del jugador...</div>
      ) : error ? (
        <div className="px-2 py-5 text-sm text-[#ffb1b1] md:px-4">{error}</div>
      ) : matches.length ? (
        <div className="space-y-3 p-2 md:p-4">
          {matches.map((match) => (
            <Link
              key={match.fixtureId}
              href={`/partido/${match.fixtureId}`}
              className="block rounded-2xl border border-white/6 bg-[#151b22] px-2 py-3 transition duration-300 ease-out hover:-translate-y-0.5 hover:border-white/12 hover:bg-[#19212a] md:px-4 md:py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7ff0b2]">
                    {translateRoundName(match.round, tournamentName)}
                  </p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {match.home} {match.goalsHome ?? '-'} - {match.goalsAway ?? '-'} {match.away}
                  </p>
                </div>
                <p className="text-xs text-[#8d98a7]">{formatDate(match.date)}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {match.events.map((event, index) => (
                  <span
                    key={`${match.fixtureId}-${index}`}
                    className="inline-flex rounded-full border border-white/8 bg-[#0f1317] px-3 py-1 text-xs font-semibold text-[#dce5ef]"
                  >
                    {event.label}
                    {event.minute ? ` ${event.minute}'` : ''}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="px-2 py-5 text-sm text-[#8d98a7] md:px-4">
          No se encontraron partidos con ese registro en este torneo.
        </div>
      )}
    </div>
  )
}
