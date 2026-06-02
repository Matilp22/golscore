import { NextResponse } from 'next/server'

import { auditWorldCupChampions } from '@/server/world-cup-champions'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

export async function GET() {
  try {
    const audit = await auditWorldCupChampions()
    return jsonNoStore({
      endpoint: 'world-cup-champions-audit',
      ...audit,
    })
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar campeones del Mundial.',
      },
      { status: 500 }
    )
  }
}
