import { NextResponse } from 'next/server'

import { auditTeamLogoIdentity } from '@/server/champion-identity-audit'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

function readBoolean(value: string | null) {
  if (value === null) return false
  return value === 'true' || value === '1'
}

function readLimit(value: string | null) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const audit = await auditTeamLogoIdentity({
      teamName: searchParams.get('teamName'),
      leagueExternalId: searchParams.get('leagueExternalId'),
      country: searchParams.get('country'),
      competition: searchParams.get('competition'),
      onlyProblems: readBoolean(searchParams.get('onlyProblems')),
      limit: readLimit(searchParams.get('limit')),
    })

    return jsonNoStore({
      endpoint: 'team-logo-identity-audit',
      ...audit,
    })
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar identidad de escudos.',
      },
      { status: 500 }
    )
  }
}
