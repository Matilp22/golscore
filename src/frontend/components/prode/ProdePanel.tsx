'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  getProdeRoundSortValue,
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
  const [roundLeaderboard, setRoundLeaderboard] = useState<LeaderboardRow[]>([])
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null)
  const [selectedRound, setSelectedRound] = useState<string | null>(null)
  const [selectedLeaderboardRound, setSelectedLeaderboardRound] = useState<string | null>(null)
  const [isLeaderboardRoundManuallySelected, setIsLeaderboardRoundManuallySelected] =
    useState(false)
  const [message, setMessage] = useState('')
  const [rankingMessage, setRankingMessage] = useState('')
  const [roundRankingMessage, setRoundRankingMessage] = useState('')
  const [isLeaguesLoading, setIsLeaguesLoading] = useState(true)
  const [isMatchesLoading, setIsMatchesLoading] = useState(false)
  const [isRoundLeaderboardLoading, setIsRoundLeaderboardLoading] = useState(false)
  const [editingMatchIds, setEditingMatchIds] = useState<Set<string>>(new Set())
  const [predictionDrafts, setPredictionDrafts] = useState<Record<string, { home: string; away: string }>>({})
  const isEditingPrediction = editingMatchIds.size > 0
  const hasPredictionDrafts = Object.keys(predictionDrafts).length > 0
  const editingMatchIdsRef = useRef(editingMatchIds)

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
      .map(([value, matchCount]) => {
        const leagueExternalId = filteredMatches.find((match) =>
          normalizeProdeRound(match.round, match.league?.externalId) === value
        )?.league?.externalId

        return {
          value,
          label: getProdeRoundLabel(value, leagueExternalId) ?? value,
          matchCount,
          sortValue: getProdeRoundSortValue(value, leagueExternalId),
        }
      })
      .sort((a, b) => {
        if (a.sortValue !== b.sortValue) return a.sortValue - b.sortValue
        return a.label.localeCompare(b.label, 'es-AR', { numeric: true })
      })
      .map(({ sortValue, ...round }) => {
        void sortValue
        return round
      })
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

  useEffect(() => {
    editingMatchIdsRef.current = editingMatchIds
  }, [editingMatchIds])

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
          silent && editingMatchIdsRef.current.size
            ? matchesData.map((match) =>
                editingMatchIdsRef.current.has(match.id)
                  ? currentMatches.find((currentMatch) => currentMatch.id === match.id) ?? match
                  : match
              )
            : matchesData
        )

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
    [selectedLeagueId]
  )

  const loadLeaderboard = useCallback(async () => {
    if (!selectedLeagueId) {
      setLeaderboard([])
      return
    }

    try {
      const leaderboardData = await getLeaderboard({ leagueId: selectedLeagueId })

      setLeaderboard(leaderboardData)
      setRankingMessage('')
    } catch {
      setLeaderboard([])
      setRankingMessage('Todavía no hay puntos calculados.')
    }
  }, [selectedLeagueId])

  const loadRoundLeaderboard = useCallback(async () => {
    if (!selectedLeagueId || !selectedLeaderboardRound) {
      setRoundLeaderboard([])
      setIsRoundLeaderboardLoading(false)
      return
    }

    setIsRoundLeaderboardLoading(true)

    try {
      const leaderboardData = await getLeaderboard({
        leagueId: selectedLeagueId,
        round: selectedLeaderboardRound,
      })

      setRoundLeaderboard(leaderboardData)
      setRoundRankingMessage('')
    } catch {
      setRoundLeaderboard([])
      setRoundRankingMessage('Todavía no hay puntos para esta fecha.')
    } finally {
      setIsRoundLeaderboardLoading(false)
    }
  }, [selectedLeagueId, selectedLeaderboardRound])

  const loadPredictions = useCallback(
    async ({ silent = false } = {}) => {
      if (!user || !selectedLeagueId) {
        setPredictions([])
        return
      }

      try {
        const predictionsData = await getMyPredictions({ leagueId: selectedLeagueId })

        setPredictions((currentPredictions) =>
          silent && editingMatchIdsRef.current.size
            ? predictionsData.map((prediction) =>
                editingMatchIdsRef.current.has(prediction.matchId)
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
    [selectedLeagueId, user]
  )

  const { markUpdatedNow } = useAutoRefresh({
    intervalMs: PRODE_REFRESH_INTERVAL_MS,
    enabled:
      Boolean(selectedLeagueId) &&
      !isLeaguesLoading &&
      !isMatchesLoading &&
      !isEditingPrediction &&
      !hasPredictionDrafts,
    refreshOnFocus: false,
    onRefresh: async () => {
      if (isEditingPrediction || hasPredictionDrafts) return

      await loadMatches({ silent: true })

      await Promise.all([
        loadLeaderboard(),
        loadRoundLeaderboard(),
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
    if (!rounds.length) {
      setSelectedLeaderboardRound(null)
      setRoundLeaderboard([])
      setRoundRankingMessage('')
      setIsLeaderboardRoundManuallySelected(false)
      setIsRoundLeaderboardLoading(false)
      return
    }

    const fallbackRound = effectiveSelectedRound ?? rounds[0]?.value ?? null
    const currentStillExists =
      selectedLeaderboardRound !== null &&
      rounds.some((round) => round.value === selectedLeaderboardRound)

    if (!currentStillExists) {
      setSelectedLeaderboardRound(fallbackRound)
      setIsLeaderboardRoundManuallySelected(false)
      return
    }

    if (
      !isLeaderboardRoundManuallySelected &&
      fallbackRound &&
      selectedLeaderboardRound !== fallbackRound
    ) {
      setSelectedLeaderboardRound(fallbackRound)
    }
  }, [
    effectiveSelectedRound,
    isLeaderboardRoundManuallySelected,
    rounds,
    selectedLeaderboardRound,
  ])

  useEffect(() => {
    if (isAuthLoading || !selectedLeagueId) return

    void Promise.all([
      loadLeaderboard(),
      user ? loadPredictions() : Promise.resolve(setPredictions([])),
    ])
  }, [isAuthLoading, loadLeaderboard, loadPredictions, selectedLeagueId, user])

  useEffect(() => {
    if (!selectedLeagueId || !selectedLeaderboardRound) return

    void loadRoundLeaderboard()
  }, [loadRoundLeaderboard, selectedLeagueId, selectedLeaderboardRound])

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
      getMyPredictions({ leagueId: selectedLeagueId }),
      loadLeaderboard(),
      loadRoundLeaderboard(),
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
    <div className="w-full min-w-0 space-y-3 md:space-y-4">
      <PointsSummary myRanking={myRanking} predictions={predictions} />

      <div className="grid w-full min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-4">
        <div className="w-full min-w-0 space-y-3 md:space-y-4">
          <MatchFilters
            leagues={leagues}
            rounds={rounds}
            selectedLeagueId={selectedLeagueId}
            selectedRound={effectiveSelectedRound}
            onLeagueChange={(leagueId) => {
              setMessage('')
              setRankingMessage('')
              setIsMatchesLoading(true)
              setEditingMatchIds(new Set())
              setPredictionDrafts({})
              setMatches([])
              setPredictions([])
              setLeaderboard([])
              setRoundLeaderboard([])
              setSelectedLeaderboardRound(null)
              setRoundRankingMessage('')
              setIsLeaderboardRoundManuallySelected(false)
              setIsRoundLeaderboardLoading(false)
              setSelectedLeagueId(leagueId)
              setSelectedRound(null)
            }}
            onRoundChange={(round) => {
              setMessage('')
              setSelectedRound(round)
              setSelectedLeaderboardRound(round)
              setIsLeaderboardRoundManuallySelected(false)
            }}
          />
          {isLeaguesLoading || isMatchesLoading || isAuthLoading ? (
            <div className="w-full rounded-2xl border border-white/8 bg-[#10151a]/95 p-4">
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
            <div className="w-full rounded-2xl border border-white/8 bg-[#10151a]/95 px-3 py-3 text-sm text-[#dce7f2] md:px-4">
              {message}
            </div>
          ) : null}
        </div>

        <div className="w-full min-w-0 space-y-3 md:space-y-4">
          <LeaderboardTable
            rows={leaderboard}
            roundRows={roundLeaderboard}
            rounds={rounds}
            selectedRound={selectedLeaderboardRound}
            isRoundLoading={isRoundLeaderboardLoading}
            totalMessage={rankingMessage}
            roundMessage={roundRankingMessage}
            onRoundChange={(round) => {
              setSelectedLeaderboardRound(round)
              setIsLeaderboardRoundManuallySelected(true)
            }}
          />
          <section className="w-full rounded-2xl border border-white/8 bg-[#10151a]/95 shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
            <div className="border-b border-white/7 px-3 py-3 sm:px-4">
              <h2 className="text-lg font-black text-white">Reglas del prode</h2>
            </div>
            <div className="p-3">
              <ul className="grid gap-2 text-sm text-[#dce7f2]">
                <li className="flex items-center justify-between gap-3 rounded-xl border border-white/7 bg-white/[0.025] px-3 py-2">
                  <span>Resultado exacto</span>
                  <span className="font-black text-[#7ff0b2]">3 pts</span>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-xl border border-white/7 bg-white/[0.025] px-3 py-2">
                  <span>Ganador o empate</span>
                  <span className="font-black text-[#7ff0b2]">1 pt</span>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-xl border border-white/7 bg-white/[0.025] px-3 py-2">
                  <span>Incorrecto</span>
                  <span className="font-black text-[#8d98a7]">0 pts</span>
                </li>
                <li className="rounded-xl border border-white/7 bg-white/[0.025] px-3 py-2 text-[#9aa7b5]">
                  Bloqueo 15 minutos antes del inicio.
                </li>
              </ul>
            </div>
          </section>
          {SHOW_MY_PREDICTIONS ? (
            <section className="w-full rounded-2xl border border-white/8 bg-[#111418]">
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
