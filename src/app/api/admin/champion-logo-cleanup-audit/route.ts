import { NextResponse } from 'next/server'

import { auditChampionLogoCleanup } from '@/server/champion-identity-audit'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get('dryRun') !== 'false'
    const audit = await auditChampionLogoCleanup()

    return jsonNoStore({
      endpoint: 'champion-logo-cleanup-audit',
      dryRun,
      mutationsApplied: false,
      ...audit,
    })
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar limpieza de logos de campeones.',
      },
      { status: 500 }
    )
  }
}
