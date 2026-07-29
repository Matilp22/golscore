import { NextRequest, NextResponse } from 'next/server'

import { getNewsArticles } from '@/content/editorial'
import { getAdminClient } from '@/server/admin/shared'
import { listPublicMiTorneitoTournaments } from '@/server/mi-torneito/repository'
import type {
  GlobalActionArticle,
  GlobalActionPlayer,
  GlobalActionTeam,
  GlobalActionTournament,
  GlobalSearchCatalogData,
} from '@/shared/global-actions-data'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type TeamSearchRow = {
  external_id: string | number | null
  name: string | null
  logo_url: string | null
}

type PlayerSearchRow = {
  external_id: string | number | null
  name: string | null
  photo_url: string | null
  team_external_id: string | number | null
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function safeSearchPattern(value: string) {
  return value.replace(/[%_,]/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatSearchError(value: unknown) {
  if (value instanceof Error) return value.message
  if (value && typeof value === 'object' && 'message' in value) {
    return String(value.message)
  }

  return String(value)
}

function buildPlayerHref(row: PlayerSearchRow) {
  const id = String(row.external_id)
  const searchParams = new URLSearchParams()

  if (row.name) searchParams.set('name', row.name)
  if (row.photo_url) searchParams.set('photo', row.photo_url)
  if (row.team_external_id) {
    searchParams.set('teamId', String(row.team_external_id))
  }

  const query = searchParams.toString()
  return `/jugador/${id}${query ? `?${query}` : ''}`
}

async function searchTeams(pattern: string): Promise<GlobalActionTeam[]> {
  const { data, error } = await getAdminClient()
    .from('teams')
    .select('external_id, name, logo_url')
    .not('external_id', 'is', null)
    .ilike('name', `%${pattern}%`)
    .order('name', { ascending: true })
    .limit(8)

  if (error) throw error

  return ((data ?? []) as TeamSearchRow[])
    .filter((row) => row.external_id && row.name)
    .map((row) => ({
      id: String(row.external_id),
      name: row.name as string,
      logoUrl: row.logo_url,
      country: null,
      href: `/equipo/${row.external_id}`,
    }))
}

async function searchPlayers(pattern: string): Promise<GlobalActionPlayer[]> {
  const { data, error } = await getAdminClient()
    .from('players')
    .select('external_id, name, photo_url, team_external_id')
    .not('external_id', 'is', null)
    .ilike('name', `%${pattern}%`)
    .order('name', { ascending: true })
    .limit(8)

  if (error) throw error

  return ((data ?? []) as PlayerSearchRow[])
    .filter((row) => row.external_id && row.name)
    .map((row) => ({
      id: String(row.external_id),
      name: row.name as string,
      photoUrl: row.photo_url,
      teamId: row.team_external_id ? String(row.team_external_id) : null,
      href: buildPlayerHref(row),
    }))
}

function searchArticles(query: string): GlobalActionArticle[] {
  const normalizedQuery = normalizeSearch(query)

  return getNewsArticles()
    .filter((article) =>
      [article.title, article.summary, article.category, ...article.tags].some(
        (value) => normalizeSearch(value).includes(normalizedQuery)
      )
    )
    .slice(0, 8)
    .map((article) => ({
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      category: article.category,
      href: `/noticias/${article.slug}`,
    }))
}

async function searchTournaments(query: string): Promise<{
  items: GlobalActionTournament[]
  partial: boolean
}> {
  const result = await listPublicMiTorneitoTournaments(100)
  const normalizedQuery = normalizeSearch(query)

  return {
    partial: Boolean(result.error),
    items: result.data
      .filter((tournament) =>
        [
          tournament.name,
          tournament.city,
          tournament.season,
          tournament.shortDescription,
        ].some(
          (value) =>
            value && normalizeSearch(value).includes(normalizedQuery)
        )
      )
      .slice(0, 8)
      .map((tournament) => ({
        id: tournament.id,
        name: tournament.name,
        city: tournament.city,
        season: tournament.season,
        status: tournament.status,
        logoUrl: tournament.logoUrl,
        href: `/mi-torneito/t/${tournament.slug}`,
      })),
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim().slice(0, 60) ?? ''
  const pattern = safeSearchPattern(query)

  if (pattern.length < 2) {
    const emptyPayload: GlobalSearchCatalogData = {
      generatedAt: new Date().toISOString(),
      query,
      partial: false,
      teams: [],
      players: [],
      articles: [],
      tournaments: [],
    }

    return NextResponse.json(emptyPayload)
  }

  const [teamsResult, playersResult, tournamentsResult] =
    await Promise.allSettled([
      searchTeams(pattern),
      searchPlayers(pattern),
      searchTournaments(query),
    ])

  const partial =
    teamsResult.status === 'rejected' ||
    playersResult.status === 'rejected' ||
    tournamentsResult.status === 'rejected' ||
    (tournamentsResult.status === 'fulfilled' &&
      tournamentsResult.value.partial)

  if (teamsResult.status === 'rejected') {
    console.warn('[search-catalog] No se pudieron buscar equipos.', {
      message: formatSearchError(teamsResult.reason),
    })
  }

  if (playersResult.status === 'rejected') {
    console.warn('[search-catalog] No se pudieron buscar jugadores.', {
      message: formatSearchError(playersResult.reason),
    })
  }

  if (tournamentsResult.status === 'rejected') {
    console.warn('[search-catalog] No se pudieron buscar torneos.', {
      message: formatSearchError(tournamentsResult.reason),
    })
  }

  const payload: GlobalSearchCatalogData = {
    generatedAt: new Date().toISOString(),
    query,
    partial,
    teams: teamsResult.status === 'fulfilled' ? teamsResult.value : [],
    players: playersResult.status === 'fulfilled' ? playersResult.value : [],
    articles: searchArticles(query),
    tournaments:
      tournamentsResult.status === 'fulfilled'
        ? tournamentsResult.value.items
        : [],
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'private, max-age=30',
    },
  })
}
