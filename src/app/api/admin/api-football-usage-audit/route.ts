import { NextResponse } from 'next/server'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type UsageFinding = {
  file: string
  line: number
  pattern: string
  snippet: string
  classification: 'allowed-sync-admin' | 'public-render-migrated' | 'review'
}

const SEARCH_ROOTS = ['src/app', 'src/server', 'src/frontend', 'src/lib']
const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])
const PATTERNS = [
  'v3.football.api-sports.io',
  'FOOTBALL_API_KEY',
  'requestFootballApi',
  'apiFootball(',
  'getMatchesByDate(',
  'getMatchDetail(',
  'getLeagueStandings(',
  'getLeagueFixtures(',
  'getTeamDetail(',
  'getPlayerDetail(',
]

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')

  return response
}

function getAuthorizationToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i)

  return bearerMatch?.[1] ?? request.headers.get('x-cron-secret')
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret) return !isProduction

  return getAuthorizationToken(request) === cronSecret
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(/*turbopackIgnore: true*/ directory, { withFileTypes: true }).catch(() => [])
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      files.push(...await walkFiles(fullPath))
      continue
    }

    if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath)
    }
  }

  return files
}

function normalizePath(filePath: string) {
  return filePath.replaceAll(path.sep, '/')
}

function classifyFile(file: string): UsageFinding['classification'] {
  const normalized = normalizePath(file)

  if (
    normalized.includes('/api/admin/') ||
    normalized.includes('/api/cron/') ||
    normalized.endsWith('/src/server/config/env.ts') ||
    normalized.endsWith('/src/server/prode/sync-matches.ts') ||
    normalized.endsWith('/src/server/integrations/football-api-client.ts')
  ) {
    return 'allowed-sync-admin'
  }

  if (
    normalized.endsWith('/src/app/page.tsx') ||
    normalized.includes('/src/app/liga/') ||
    normalized.includes('/src/app/partido/') ||
    normalized.includes('/src/app/equipo/') ||
    normalized.includes('/src/app/jugador/') ||
    normalized.includes('/src/app/api/home/') ||
    normalized.endsWith('/src/server/integrations/api-football.ts')
  ) {
    return 'public-render-migrated'
  }

  return 'review'
}

function findExternalEndpoints(source: string) {
  const endpoints = new Set<string>()
  const patterns = [
    /requestFootballApi\(\s*['"]([^'"]+)['"]/g,
    /apiFootball\(\s*['"]([^'"]+)['"]/g,
  ]

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      endpoints.add(match[1])
    }
  }

  return [...endpoints].sort()
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const cwd = /*turbopackIgnore: true*/ process.cwd()
  const files = (
    await Promise.all(SEARCH_ROOTS.map((root) => walkFiles(path.join(/*turbopackIgnore: true*/ process.cwd(), root))))
  ).flat()
  const findings: UsageFinding[] = []
  const externalEndpoints = new Set<string>()

  for (const file of files) {
    const relativeFile = normalizePath(path.relative(cwd, file))
    if (relativeFile === 'src/app/api/admin/api-football-usage-audit/route.ts') {
      continue
    }

    const source = await readFile(file, 'utf8').catch(() => '')
    if (!source) continue

    for (const endpoint of findExternalEndpoints(source)) {
      externalEndpoints.add(endpoint)
    }

    const lines = source.split(/\r?\n/)
    lines.forEach((line, index) => {
      for (const pattern of PATTERNS) {
        if (!line.includes(pattern)) continue

        findings.push({
          file: relativeFile,
          line: index + 1,
          pattern,
          snippet: line.trim(),
          classification: classifyFile(file),
        })
      }
    })
  }

  const allowed = findings.filter((finding) => finding.classification === 'allowed-sync-admin')
  const migrated = findings.filter((finding) => finding.classification === 'public-render-migrated')
  const review = findings.filter((finding) => finding.classification === 'review')

  return jsonNoStore({
    ok: true,
    summary: {
      totalFindings: findings.length,
      allowedSyncAdmin: allowed.length,
      publicRenderMigrated: migrated.length,
      review: review.length,
      externalEndpoints: [...externalEndpoints],
    },
    allowedSyncAdmin: allowed,
    publicRenderMigrated: migrated,
    review,
    blockedOrMigratedToSupabase: [
      'Home: getMatchesByDate ahora lee matches/football_fixture_cache y no completa con API-Football.',
      'Liga: resolveTournament/getLeagueFixtures/getLeagueStandings leen Supabase/cache.',
      'Detalle de partido: getMatchDetail lee matches, match_events, broadcasters y highlights desde Supabase.',
      'Equipo/Jugador: fichas publicas usan Supabase/fallback local, sin llamada externa por visita.',
      'Rankings: getLeagueLeaders usa match_events; si no hay eventos devuelve listas vacias.',
    ],
    recommendations: [
      'Mantener requestFootballApi solo dentro de endpoints admin/cron o servicios de sync.',
      'Sincronizar fixtures con /api/cron/sync-fixtures antes de depender de una competencia nueva en render publico.',
      'No mostrar errores de API-Football en UI publica; usar estados vacios o mensajes amigables.',
    ],
  })
}
