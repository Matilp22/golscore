import { NextResponse } from 'next/server'

import {
  getPlayerEventMatches,
  type LeaderStatType,
} from '@/lib/api-football'

const VALID_STAT_TYPES: LeaderStatType[] = [
  'scorers',
  'assists',
  'yellowCards',
  'redCards',
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const leagueId = Number(searchParams.get('leagueId'))
  const season = Number(searchParams.get('season'))
  const playerId = Number(searchParams.get('playerId'))
  const teamId = Number(searchParams.get('teamId'))
  const expectedCount = Number(searchParams.get('expectedCount'))
  const statType = searchParams.get('statType') as LeaderStatType | null
  const playerName = searchParams.get('playerName') || undefined

  if (!leagueId || !season || !playerId || !statType || !VALID_STAT_TYPES.includes(statType)) {
    return NextResponse.json(
      { error: 'Parametros invalidos para consultar el detalle del jugador.' },
      { status: 400 }
    )
  }

  try {
    const matches = await getPlayerEventMatches(
      leagueId,
        season,
        playerId,
        statType,
        playerName,
        teamId || undefined,
        expectedCount || undefined
      )
    return NextResponse.json({ matches })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo cargar el detalle del jugador.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
