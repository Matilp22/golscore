'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import LeaderboardTable from '@/frontend/components/prode/LeaderboardTable'
import MatchFilters from '@/frontend/components/prode/MatchFilters'
import MatchList from '@/frontend/components/prode/MatchList'
import PointsSummary from '@/frontend/components/prode/PointsSummary'
import PredictionCard from '@/frontend/components/prode/PredictionCard'
import { useAuth } from '@/frontend/hooks/useAuth'
import { useAutoRefresh } from '@/frontend/hooks/useAutoRefresh'
import { getLeaderboard } from '@/frontend/services/leaderboardService'
import { getLeagues } from '@/frontend/services/leaguesService'
import { getMatches } from '@/frontend/services/matchesService'
import {
  getMyPredictions,
  savePrediction,
} from '@/frontend/services/predictionsService'
import {
  getCurrentProdeRound,
  getProdeRoundLabel,
  isVisibleProdeRound,
  normalizeProdeRound,
} from '@/shared/config/prode-rounds'
import type {
  LeaderboardRow,
  League,
  Match,
  Prediction,
  RoundOption,
} from '@/frontend/types/prode'

export default function ProdePanel() {
  const SHOW_MY_PREDICTIONS = false
  const PRODE_REFRESH_INTERVAL_MS = 180000
  const { user, isLoading: isAuthLoading } = useAuth()
  const [leagues, setLeagues] = useState<League[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null)
  const [selectedRound, setSelectedRound] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [rankingMessage, setRankingMessage] = useState('')
  const [isLeaguesLoading, setIsLeaguesLoading] = useState(true)
  const [isMatchesLoading, setIsMatchesLoading] = useState(false)
  const [editingMatchIds, setEditingMatchIds] = useState<Set<string>>(new Set())
  const [predictionDrafts, setPredictionDrafts] = useState<Record<string, { home: string; away: string }>>({})
  const isEditingPrediction = editingMatchIds.size > 0

  const predictionsByMatchId = useMemo(() => {
    return new Map(predictions.map((prediction) => [prediction.matchId, prediction]))
  }, [predictions])
  const predictionDraftsByMatchId = useMemo(() => {
    return new Map(Object.entries(predictionDrafts))
  }, [predictionDrafts])

  const myRanking = leaderboard.find((row) => row.userId === user?.id)

  const filteredMatches = useMemo(
    () =>
      matches.filter((match) =>
        isVisibleProdeRound(match.round, match.league?.externalId)
      ),
    [matches]
  )

  const rounds = useMemo<RoundOption[]>(() => {
    const counts = new Map<string, number>()

    for (const match of filteredMatches) {
      const normalizedRound = normalizeProdeRound(match.round, match.league?.externalId)

      if (!normalizedRound) continue
      counts.set(normalizedRound, (counts.get(normalizedRound) ?? 0) + 1)
    }

    return [...counts.entries()]
      .map(([value, matchCount]) => ({
        value,
        label: getProdeRoundLabel(value, filteredMatches.find((match) =>
          normalizeProdeRound(match.round, match.league?.externalId) === value
        )?.league?.externalId) ?? value,
        matchCount,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es-AR', { numeric: true }))
  }, [filteredMatches])

  const currentRound = useMemo(
    () => getCurrentProdeRound(filteredMatches),
    [filteredMatches]
  )

  const effectiveSelectedRound = useMemo(() => {
    if (!selectedRound) return currentRound

    return rounds.some((round) => round.value === selectedRound)
      ? selectedRound
      : currentRound
  }, [currentRound, rounds, selectedRound])

  const visibleMatches = useMemo(() => {
    if (!effectiveSelectedRound) return filteredMatches

    return filteredMatches.filter(
      (match) =>
        normalizeProdeRound(match.round, match.league?.externalId) === effectiveSelectedRound
    )
  }, [effectiveSelectedRound, filteredMatches])

  const visibleMatchesById = useMemo(() => {
    return new Map(visibleMatches.map((match) => [match.id, match]))
  }, [visibleMatches])

  const visiblePredictions = useMemo(() => {
    if (!visibleMatchesById.size) return []

    return predictions.filter((prediction) => visibleMatchesById.has(prediction.matchId))
  }, [predictions, visibleMatchesById])

  const loadMatches = useCallback(
    async ({ silent = false } = {}) => {
      if (!selectedLeagueId) return false

      if (!silent) {
        setIsMatchesLoading(true)
      }

      try {
        const matchesData = await getMatches({
          leagueId: selectedLeagueId,
        })

        setMatches((currentMatches) =>
          silent && editingMatchIds.size
            ? matchesData.map((match) =>
                editingMatchIds.has(match.id)
                  ? currentMatches.find((currentMatch) => currentMatch.id === match.id) ?? match
                  : match
              )
            : matchesData
        )

        console.info('[prode-panel] partidos recibidos', {
          selectedLeagueId,
          matches: matchesData.length,
          rounds: [...new Set(matchesData.map((match) => match.round).filter(Boolean))],
          normalizedRounds: [
            ...new Set(
              matchesData
                .map((match) => normalizeProdeRound(match.round, match.league?.externalId))
                .filter(Boolean)
            ),
          ],
          silent,
        })

        return true
      } catch (error: unknown) {
        if (!silent) {
          setMatches([])
          setMessage(
            error instanceof Error && error.message
              ? error.message
              : 'No se pudieron cargar los partidos.'
          )
        }

        return false
      } finally {
        if (!silent) {
          setIsMatchesLoading(false)
        }
      }
    },
    [editingMatchIds, selectedLeagueId]
  )

  const loadLeaderboard = useCallback(async () => {
    try {
      const leaderboardData = await getLeaderboard()

      setLeaderboard(leaderboardData)
      setRankingMessage('')
    } catch {
      setLeaderboard([])
      setRankingMessage('Todavía no hay puntos calculados.')
    }
  }, [])

  const loadPredictions = useCallback(
    async ({ silent = false } = {}) => {
      if (!user) {
        setPredictions([])
        return
      }

      try {
        const predictionsData = await getMyPredictions()

        setPredictions((currentPredictions) =>
          silent && editingMatchIds.size
            ? predictionsData.map((prediction) =>
                editingMatchIds.has(prediction.matchId)
                  ? currentPredictions.find(
                      (currentPrediction) => currentPrediction.matchId === prediction.matchId
                    ) ?? prediction
                  : prediction
              )
            : predictionsData
        )
      } catch (error: unknown) {
        if (!silent) {
          setMessage(
            error instanceof Error ? error.message : 'No se pudieron cargar tus predicciones.'
          )
        }
      }
    },
    [editingMatchIds, user]
  )

  const { markUpdatedNow } = useAutoRefresh({
    intervalMs: PRODE_REFRESH_INTERVAL_MS,
    enabled:
      Boolean(selectedLeagueId) &&
      !isLeaguesLoading &&
      !isMatchesLoading &&
      !isEditingPrediction,
    refreshOnFocus: false,
    onRefresh: async () => {
      if (isEditingPrediction) return

      await loadMatches({ silent: true })

      await Promise.all([
        loadLeaderboard(),
        loadPredictions({ silent: true }),
      ])
    },
  })

  useEffect(() => {
    let active = true

    getLeagues()
      .then((leaguesData) => {
        if (!active) return

        setLeagues(leaguesData)
        console.info('[prode-panel] ligas detectadas', {
          count: leaguesData.length,
          leagues: leaguesData.map((league) => ({
            id: league.id,
            externalId: league.externalId,
            name: league.name,
          })),
        })

        if (leaguesData[0]) {
          setSelectedLeagueId((current) => {
            if (current) return current

            setIsMatchesLoading(true)
            return leaguesData[0].id
          })
        }
      })
      .catch((error: unknown) => {
        if (!active) return

        setMessage(
          error instanceof Error && error.message
            ? error.message
            : 'No se pudieron cargar los torneos.'
        )
      })
      .finally(() => {
        if (active) setIsLeaguesLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    if (!selectedLeagueId) {
      return
    }

    void loadMatches().then((loaded) => {
      if (active && loaded) {
        markUpdatedNow()
      }
    })

    return () => {
      active = false
    }
  }, [loadMatches, markUpdatedNow, selectedLeagueId])

  useEffect(() => {
    console.info('[prode-panel] filtro aplicado', {
      selectedLeagueId,
      selectedRound: effectiveSelectedRound,
      totalMatchesForLeague: matches.length,
      visibleMatches: visibleMatches.length,
      availableRounds: rounds.length,
    })
  }, [effectiveSelectedRound, matches.length, rounds.length, selectedLeagueId, visibleMatches.length])

  useEffect(() => {
    void loadLeaderboard()
  }, [loadLeaderboard])

  useEffect(() => {
    if (!user) {
      setPredictions([])
      return
    }

    void loadPredictions()
  }, [loadPredictions, user])

  const handleSavePrediction = async (input: {
    matchId: string
    predictedHomeScore: number
    predictedAwayScore: number
  }) => {
    setMessage('')
    const savedPrediction = await savePrediction(input)

    setPredictions((current) => {
      const withoutCurrent = current.filter(
        (prediction) => prediction.matchId !== savedPrediction.matchId
      )

      const previous = current.find((prediction) => prediction.matchId === savedPrediction.matchId)

      return [
        {
          ...previous,
          ...savedPrediction,
          points: savedPrediction.points ?? previous?.points ?? 0,
          exactHit: savedPrediction.exactHit ?? previous?.exactHit ?? false,
          partialHit: savedPrediction.partialHit ?? previous?.partialHit ?? false,
        },
        ...withoutCurrent,
      ]
    })

    setEditingMatchIds((current) => {
      const next = new Set(current)
      next.delete(input.matchId)
      return next
    })
    setPredictionDrafts((current) => {
      const next = { ...current }
      delete next[input.matchId]
      return next
    })
    markUpdatedNow()
    const [freshPredictions] = await Promise.all([
      getMyPredictions(),
      loadLeaderboard(),
    ])
    setPredictions(freshPredictions)
    setMessage('Predicción guardada.')
  }

  const handleEditingChange = useCallback((matchId: string, isEditing: boolean) => {
    setEditingMatchIds((current) => {
      if (isEditing && current.has(matchId)) return current
      if (!isEditing && !current.has(matchId)) return current

      const next = new Set(current)

      if (isEditing) {
        next.add(matchId)
      } else {
        next.delete(matchId)
      }

      return next
    })
  }, [])

  const handleDraftChange = useCallback(
    (matchId: string, draft: { home: string; away: string }) => {
      setPredictionDrafts((current) => {
        const currentDraft = current[matchId]

        if (currentDraft?.home === draft.home && currentDraft.away === draft.away) {
          return current
        }

        return {
          ...current,
          [matchId]: draft,
        }
      })
    },
    []
  )

  return (
    <div className="min-w-0 space-y-4">
      <PointsSummary myRanking={myRanking} predictions={predictions} />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <MatchFilters
            leagues={leagues}
            rounds={rounds}
            selectedLeagueId={selectedLeagueId}
            selectedRound={effectiveSelectedRound}
            onLeagueChange={(leagueId) => {
              setMessage('')
              setIsMatchesLoading(true)
              setEditingMatchIds(new Set())
              setPredictionDrafts({})
              setSelectedLeagueId(leagueId)
              setSelectedRound(null)
            }}
            onRoundChange={(round) => {
              setMessage('')
              setSelectedRound(round)
            }}
          />
          {isLeaguesLoading || isMatchesLoading || isAuthLoading ? (
            <div className="rounded-2xl border border-white/8 bg-[#111418] p-4 sm:p-6">
              <h2 className="text-lg font-black text-white">Partidos</h2>
              <p className="mt-2 text-sm text-[#8d98a7]">Cargando partidos...</p>
            </div>
          ) : (
            <MatchList
              matches={visibleMatches}
              predictionsByMatchId={predictionsByMatchId}
              predictionDraftsByMatchId={predictionDraftsByMatchId}
              isAuthenticated={Boolean(user)}
              isAuthLoading={isAuthLoading}
              onEditingChange={handleEditingChange}
              onDraftChange={handleDraftChange}
              onSavePrediction={handleSavePrediction}
            />
          )}

          {message ? (
            <div className="rounded-2xl border border-white/8 bg-[#0f1317] px-4 py-3 text-sm text-[#dce7f2]">
              {message}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <LeaderboardTable rows={leaderboard} />
          {rankingMessage ? (
            <p className="rounded-2xl border border-white/8 bg-[#0f1317] px-4 py-3 text-sm text-[#8d98a7]">
              {rankingMessage}
            </p>
          ) : null}
          <section className="rounded-2xl border border-white/8 bg-[#111418]">
            <div className="border-b border-white/8 px-3 py-3 sm:px-4">
              <h2 className="text-lg font-black text-white">Reglas del prode</h2>
            </div>
            <div className="p-3 sm:p-4">
              <ul className="space-y-2 text-sm text-[#dce7f2]">
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7ff0b2]" />
                  <span>Resultado exacto: 3 puntos</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7ff0b2]" />
                  <span>Acierto de ganador o empate: 1 punto</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7ff0b2]" />
                  <span>Pronóstico incorrecto: 0 puntos</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7ff0b2]" />
                  <span>Las predicciones se bloquean 15 minutos antes del inicio del partido</span>
                </li>
              </ul>
            </div>
          </section>
          {SHOW_MY_PREDICTIONS ? (
            <section className="rounded-2xl border border-white/8 bg-[#111418]">
              <div className="border-b border-white/8 px-4 py-3">
                <h2 className="text-lg font-black text-white">Mis predicciones</h2>
              </div>
              <div className="space-y-2 p-4">
                {user ? (
                  predictions.length ? (
                    visiblePredictions.length ? (
                      visiblePredictions.slice(0, 6).map((prediction) => (
                        <PredictionCard
                          key={prediction.id}
                          prediction={prediction}
                          match={visibleMatchesById.get(prediction.matchId)}
                        />
                      ))
                    ) : (
                      <p className="text-sm text-[#8d98a7]">
                        No hay predicciones para el torneo o la fecha seleccionada.
                      </p>
                    )
                  ) : (
                    <p className="text-sm text-[#8d98a7]">
                      Todavía no guardaste predicciones.
                    </p>
                  )
                ) : (
                  <p className="text-sm text-[#8d98a7]">
                    Iniciá sesión para ver tus predicciones.
                  </p>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
