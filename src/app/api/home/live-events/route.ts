import { NextResponse } from 'next/server'
import {
  getMatchesByDate,
  withGoalScorers,
  type HomeLiveEvent,
} from '@/lib/api-football'
import { getArgentinaTodayISO } from '@/shared/utils/argentina-time'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || getArgentinaTodayISO()

  try {
    const matches = await withGoalScorers(await getMatchesByDate(date))
    const events = matches.reduce<HomeLiveEvent[]>((accumulator, match) => {
      accumulator.push(...(match.liveEvents || []))
      return accumulator
    }, [])

    return NextResponse.json(
      {
        ok: true,
        date,
        events,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.warn('[home-live-events] No se pudieron leer eventos en vivo.', {
      date,
      message: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      {
        ok: false,
        date,
        events: [],
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  }
}
