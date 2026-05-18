import type { SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { requestFootballApi } from '@/server/integrations/football-api-client'
import {
  getApiSportsPlayerPhotoUrl,
  getAssetHostname,
  getLeagueLogoOverrideUrl,
  isAllowedRemoteAssetHost,
  isLegacyApiFootballAssetUrl,
  normalizeAssetUrl,
  pickLeagueLogoUrl,
  pickStableAssetUrl,
  pickTeamLogoUrl,
} from '@/shared/utils/asset-urls'

type DbClient = SupabaseClient

type TeamLike = {
  id?: number | string | null
  name?: string | null
  logo?: string | null
}

type LeagueLike = {
  id?: number | string | null
  name?: string | null
  country?: string | null
  logo?: string | null
  season?: number | null
}

type PlayerLike = {
  id?: number | string | null
  name?: string | null
  number?: number | null
  pos?: string | null
  position?: string | null
  photo?: string | null
}

type PlayerWrapperLike<TPlayer extends PlayerLike = PlayerLike> = {
  player?: TPlayer
}

type MatchLineupLike<TPlayer extends PlayerLike = PlayerLike> = {
  team?: TeamLike
  formation?: string
  startXI?: PlayerWrapperLike<TPlayer>[]
  substitutes?: PlayerWrapperLike<TPlayer>[]
  coach?: {
    name?: string
  }
}

type MatchFixtureLike = {
  fixture?: {
    id?: number
  }
  league?: LeagueLike
  teams?: {
    home?: TeamLike
    away?: TeamLike
  }
}

type AssetSyncStats = {
  processed: number
  updated: number
  skipped: number
}

export type VisualAssetScope = 'teams' | 'leagues' | 'players'

export type VisualAssetSyncReport = {
  scope: VisualAssetScope
  checked: number
  updated: number
  skipped: number
  missing: number
  errors: Array<{
    target: string
    message: string
  }>
  sample: Array<{
    externalId: string | null
    name: string | null
    before: string | null
    after: string | null
    source: string
  }>
}

type TeamAssetInput = {
  externalId?: number | string | null
  name?: string | null
  logoUrl?: string | null
  leagueId?: string | null
}

type LeagueAssetInput = {
  externalId?: number | string | null
  name?: string | null
  country?: string | null
  season?: number | null
  logoUrl?: string | null
}

type PlayerAssetInput = {
  externalId?: number | string | null
  name?: string | null
  teamExternalId?: number | string | null
  number?: number | null
  position?: string | null
  photoUrl?: string | null
}

type TeamAssetRow = {
  id: string
  external_id: string | number | null
  logo_url: string | null
}

type LeagueAssetRow = {
  id: string
  external_id: string | number | null
  logo_url: string | null
}

type PlayerAssetRow = {
  external_id: string | number | null
  photo_url: string | null
}

type ApiFootballLeagueRow = {
  league?: {
    id?: number
    name?: string
    logo?: string | null
  }
  country?: {
    name?: string | null
  }
  seasons?: Array<{
    year?: number | null
    current?: boolean | null
  }>
}

type ApiFootballTeamRow = {
  team?: {
    id?: number
    name?: string
    logo?: string | null
  }
}

type ApiFootballPlayerRow = {
  player?: {
    id?: number
    name?: string
    photo?: string | null
  }
  statistics?: Array<{
    team?: {
      id?: number
      name?: string
      logo?: string | null
    }
  }>
}

type ApiFootballSquadRow = {
  team?: {
    id?: number
    name?: string
    logo?: string | null
  }
  players?: Array<{
    id?: number
    name?: string
    number?: number | null
    position?: string | null
    photo?: string | null
  }>
}

const SOURCE = 'api-football'

function toExternalId(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null

  const normalized = String(value).trim()
  return normalized ? normalized : null
}

function toFiniteInteger(value: number | null | undefined) {
  if (value === null || value === undefined) return null
  return Number.isFinite(value) ? value : null
}

function uniqueByExternalId<T extends { externalId?: number | string | null }>(items: T[]) {
  const byId = new Map<string, T>()

  for (const item of items) {
    const externalId = toExternalId(item.externalId)
    if (!externalId) continue

    const current = byId.get(externalId)
    byId.set(externalId, {
      ...(current ?? item),
      ...item,
    })
  }

  return [...byId.entries()].map(([externalId, item]) => ({
    ...item,
    externalId,
  }))
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function createAssetSyncReport(scope: VisualAssetScope): VisualAssetSyncReport {
  return {
    scope,
    checked: 0,
    updated: 0,
    skipped: 0,
    missing: 0,
    errors: [],
    sample: [],
  }
}

function addAssetSyncSample(
  report: Pick<VisualAssetSyncReport, 'sample'>,
  sample: VisualAssetSyncReport['sample'][number]
) {
  if (report.sample.length >= 12) return
  report.sample.push(sample)
}

function addAssetSyncError(
  report: VisualAssetSyncReport,
  target: string,
  error: unknown
) {
  report.errors.push({
    target,
    message: error instanceof Error ? error.message : String(error),
  })
}

function mergeAssetSyncReport<
  TTarget extends Pick<VisualAssetSyncReport, 'checked' | 'updated' | 'skipped' | 'missing' | 'errors' | 'sample'>,
>(
  target: TTarget,
  source: Pick<VisualAssetSyncReport, 'checked' | 'updated' | 'skipped' | 'missing' | 'errors' | 'sample'>
) {
  target.checked += source.checked
  target.updated += source.updated
  target.skipped += source.skipped
  target.missing += source.missing
  target.errors.push(...source.errors)

  for (const sample of source.sample) {
    addAssetSyncSample(target, sample)
  }

  return target
}

export function summarizeAssetSyncReports(
  scope: 'teams' | 'leagues' | 'players' | 'all',
  reports: VisualAssetSyncReport[]
) {
  return reports.reduce(
    (summary, report) => mergeAssetSyncReport(summary, report),
    {
      scope,
      checked: 0,
      updated: 0,
      skipped: 0,
      missing: 0,
      errors: [] as VisualAssetSyncReport['errors'],
      sample: [] as VisualAssetSyncReport['sample'],
    }
  )
}

function shouldReplacePersistedAsset(
  currentUrl: string | null | undefined,
  nextUrl: string | null | undefined,
  force: boolean
) {
  const current = normalizeAssetUrl(currentUrl)
  const next = normalizeAssetUrl(nextUrl)

  if (!next) return false
  if (!current) return true
  if (force) return current !== next
  if (isLegacyApiFootballAssetUrl(current)) return current !== next

  return false
}

function getCurrentSeasonFromApiLeague(row: ApiFootballLeagueRow, fallbackSeason?: number | null) {
  if (fallbackSeason) return fallbackSeason

  const currentSeason = row.seasons?.find((season) => season.current)?.year
  if (currentSeason) return currentSeason

  return row.seasons?.[0]?.year ?? new Date().getFullYear()
}

async function fetchAllRows<T>(supabase: DbClient, table: string, columns: string) {
  const rows: T[] = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1)

    if (error) throw error

    const page = (data ?? []) as T[]
    rows.push(...page)

    if (page.length < pageSize) break
  }

  return rows
}

async function fetchTeamIdsByExternalId(supabase: DbClient, externalIds: string[]) {
  const map = new Map<string, string>()
  if (!externalIds.length) return map

  for (const chunk of chunkArray(externalIds, 100)) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, external_id')
      .in('external_id', chunk)

    if (error) throw error

    for (const row of (data ?? []) as Array<{ id: string; external_id: string | number | null }>) {
      const externalId = toExternalId(row.external_id)
      if (externalId) map.set(externalId, String(row.id))
    }
  }

  return map
}

export async function getPersistedTeamLogoMap(
  supabase: DbClient,
  externalIds: Array<number | string | null | undefined>
) {
  const ids = [...new Set(externalIds.map(toExternalId).filter(Boolean))] as string[]
  const map = new Map<string, string>()
  if (!ids.length) return map

  for (const chunk of chunkArray(ids, 100)) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, external_id, logo_url')
      .in('external_id', chunk)

    if (error) throw error

    for (const row of (data ?? []) as TeamAssetRow[]) {
      const externalId = toExternalId(row.external_id)
      const logoUrl = pickTeamLogoUrl(row.logo_url, externalId)
      if (externalId && logoUrl) map.set(externalId, logoUrl)
    }
  }

  return map
}

export async function getPersistedLeagueLogoMap(
  supabase: DbClient,
  externalIds: Array<number | string | null | undefined>
) {
  const ids = [...new Set(externalIds.map(toExternalId).filter(Boolean))] as string[]
  const map = new Map<string, string>()
  if (!ids.length) return map

  for (const chunk of chunkArray(ids, 100)) {
    const { data, error } = await supabase
      .from('leagues')
      .select('id, external_id, logo_url')
      .in('external_id', chunk)

    if (error) throw error

    for (const row of (data ?? []) as LeagueAssetRow[]) {
      const externalId = toExternalId(row.external_id)
      const logoUrl = pickLeagueLogoUrl(row.logo_url, externalId)
      if (externalId && logoUrl) map.set(externalId, logoUrl)
    }
  }

  return map
}

export async function getPersistedPlayerPhotoMap(
  supabase: DbClient,
  externalIds: Array<number | string | null | undefined>
) {
  const ids = [...new Set(externalIds.map(toExternalId).filter(Boolean))] as string[]
  const map = new Map<string, string>()
  if (!ids.length) return map

  for (const chunk of chunkArray(ids, 100)) {
    const { data, error } = await supabase
      .from('players')
      .select('external_id, photo_url')
      .in('external_id', chunk)

    if (error) throw error

    for (const row of (data ?? []) as PlayerAssetRow[]) {
      const externalId = toExternalId(row.external_id)
      const photoUrl = pickStableAssetUrl(row.photo_url, null, getApiSportsPlayerPhotoUrl(externalId))
      if (externalId && photoUrl) map.set(externalId, photoUrl)
    }
  }

  return map
}

export async function upsertTeamAssets(
  supabase: DbClient,
  inputs: TeamAssetInput[]
): Promise<AssetSyncStats> {
  const items = uniqueByExternalId(inputs)
  if (!items.length) return { processed: 0, updated: 0, skipped: 0 }

  const syncedAt = new Date().toISOString()
  let updated = 0
  let skipped = 0

  for (const item of items) {
    const externalId = toExternalId(item.externalId)
    const logoUrl = pickTeamLogoUrl(null, externalId, item.logoUrl)

    if (!externalId) {
      skipped += 1
      continue
    }

    const row: Record<string, unknown> = {
      external_id: externalId,
      name: item.name || `Equipo ${externalId}`,
      logo_url: logoUrl,
      logo_source: SOURCE,
      logo_last_synced_at: syncedAt,
    }

    if (item.leagueId) row.league_id = item.leagueId

    const { error } = await supabase
      .from('teams')
      .upsert(row, { onConflict: 'external_id' })

    if (error) throw error
    updated += 1
  }

  return { processed: items.length, updated, skipped }
}

export async function upsertLeagueAssets(
  supabase: DbClient,
  inputs: LeagueAssetInput[]
): Promise<AssetSyncStats> {
  const items = uniqueByExternalId(inputs)
  if (!items.length) return { processed: 0, updated: 0, skipped: 0 }

  const syncedAt = new Date().toISOString()
  let updated = 0
  let skipped = 0

  for (const item of items) {
    const externalId = toExternalId(item.externalId)
    const overrideLogoUrl = getLeagueLogoOverrideUrl(externalId)
    const logoUrl = pickLeagueLogoUrl(null, externalId, item.logoUrl)

    if (!externalId) {
      skipped += 1
      continue
    }

    const row: Record<string, unknown> = {
      external_id: externalId,
      name: item.name || `Liga ${externalId}`,
      country: item.country ?? null,
      season: item.season ?? new Date().getFullYear(),
      logo_url: logoUrl,
      logo_source: overrideLogoUrl ? 'manual-override-2026' : SOURCE,
      logo_last_synced_at: syncedAt,
    }

    const { error } = await supabase
      .from('leagues')
      .upsert(row, { onConflict: 'external_id' })

    if (error) throw error
    updated += 1
  }

  return { processed: items.length, updated, skipped }
}

export async function upsertPlayerAssets(
  supabase: DbClient,
  inputs: PlayerAssetInput[]
): Promise<AssetSyncStats> {
  const items = uniqueByExternalId(inputs)
  if (!items.length) return { processed: 0, updated: 0, skipped: 0 }

  const teamExternalIds = [
    ...new Set(items.map((item) => toExternalId(item.teamExternalId)).filter(Boolean)),
  ] as string[]
  const teamIdsByExternalId = await fetchTeamIdsByExternalId(supabase, teamExternalIds)
  const syncedAt = new Date().toISOString()
  let updated = 0
  let skipped = 0

  for (const item of items) {
    const externalId = toExternalId(item.externalId)
    const teamExternalId = toExternalId(item.teamExternalId)
    const photoUrl = pickStableAssetUrl(
      null,
      item.photoUrl,
      getApiSportsPlayerPhotoUrl(externalId)
    )

    if (!externalId) {
      skipped += 1
      continue
    }

    const row: Record<string, unknown> = {
      external_id: externalId,
      name: item.name || `Jugador ${externalId}`,
      team_external_id: teamExternalId,
      team_id: teamExternalId ? teamIdsByExternalId.get(teamExternalId) ?? null : null,
      number: toFiniteInteger(item.number),
      position: item.position ?? null,
      photo_url: photoUrl,
      photo_source: SOURCE,
      photo_last_synced_at: syncedAt,
      updated_at: syncedAt,
    }

    const { error } = await supabase
      .from('players')
      .upsert(row, { onConflict: 'external_id' })

    if (error) throw error
    updated += 1
  }

  return { processed: items.length, updated, skipped }
}

async function fetchLeagueIdByExternalId(
  supabase: DbClient,
  externalId: string | number | null | undefined
) {
  const normalizedExternalId = toExternalId(externalId)
  if (!normalizedExternalId) return null

  const { data, error } = await supabase
    .from('leagues')
    .select('id')
    .eq('external_id', normalizedExternalId)
    .order('season', { ascending: false })
    .limit(1)

  if (error) throw error

  return data?.[0]?.id ? String(data[0].id) : null
}

export async function syncLeagueAssetsFromApiFootball(
  supabase: DbClient,
  options: {
    leagueExternalId?: string | number | null
    season?: number | null
    limit?: number
    force?: boolean
  } = {}
) {
  const report = createAssetSyncReport('leagues')
  const limit = Math.max(1, Math.min(options.limit ?? 500, 1000))
  const force = Boolean(options.force)

  try {
    const params = options.leagueExternalId
      ? {
          id: options.leagueExternalId,
          season: options.season ?? undefined,
        }
      : {
          current: 'true',
        }
    const { payload } = await requestFootballApi<ApiFootballLeagueRow[]>(
      '/leagues',
      params,
      { logContext: 'sync-assets:leagues' }
    )
    const apiRows = (payload.response ?? []).slice(0, limit)

    for (const apiRow of apiRows) {
      const league = apiRow.league
      const externalId = toExternalId(league?.id)
      if (!externalId) {
        report.skipped += 1
        continue
      }

      report.checked += 1

      const overrideLogoUrl = getLeagueLogoOverrideUrl(externalId)
      const desiredLogoUrl = pickLeagueLogoUrl(
        force ? null : undefined,
        externalId,
        league?.logo
      )

      if (!desiredLogoUrl) {
        report.missing += 1
        continue
      }

      const { data: rows, error } = await supabase
        .from('leagues')
        .select('id, external_id, name, country, season, logo_url, logo_source')
        .eq('external_id', externalId)

      if (error) throw error

      const leagueRows = (rows ?? []) as Array<{
        id: string
        external_id: string | number | null
        name: string | null
        country: string | null
        season: number | null
        logo_url: string | null
        logo_source: string | null
      }>

      if (!leagueRows.length) {
        if (!options.leagueExternalId) {
          report.skipped += 1
          continue
        }

        await upsertLeagueAssets(supabase, [
          {
            externalId,
            name: league?.name,
            country: apiRow.country?.name,
            season: getCurrentSeasonFromApiLeague(apiRow, options.season),
            logoUrl: league?.logo,
          },
        ])
        report.updated += 1
        addAssetSyncSample(report, {
          externalId,
          name: league?.name ?? null,
          before: null,
          after: desiredLogoUrl,
          source: overrideLogoUrl ? 'manual-override-2026' : SOURCE,
        })
        continue
      }

      let changedAny = false

      for (const row of leagueRows) {
        const nextLogoUrl = force
          ? desiredLogoUrl
          : pickLeagueLogoUrl(row.logo_url, externalId, league?.logo)
        const sourceNeedsUpdate = Boolean(overrideLogoUrl) && row.logo_source !== 'manual-override-2026'
        const shouldUpdate =
          sourceNeedsUpdate ||
          shouldReplacePersistedAsset(row.logo_url, nextLogoUrl, force) ||
          normalizeAssetUrl(row.logo_url) !== normalizeAssetUrl(nextLogoUrl)

        if (!shouldUpdate) continue

        const { error: updateError } = await supabase
          .from('leagues')
          .update({
            name: row.name || league?.name || `Liga ${externalId}`,
            country: row.country ?? apiRow.country?.name ?? null,
            season: row.season ?? getCurrentSeasonFromApiLeague(apiRow, options.season),
            logo_url: nextLogoUrl,
            logo_source: overrideLogoUrl ? 'manual-override-2026' : SOURCE,
            logo_last_synced_at: new Date().toISOString(),
          })
          .eq('id', row.id)

        if (updateError) throw updateError
        changedAny = true
        addAssetSyncSample(report, {
          externalId,
          name: row.name ?? league?.name ?? null,
          before: row.logo_url,
          after: nextLogoUrl,
          source: overrideLogoUrl ? 'manual-override-2026' : SOURCE,
        })
      }

      if (changedAny) {
        report.updated += 1
      } else {
        report.skipped += 1
      }
    }
  } catch (error) {
    addAssetSyncError(report, options.leagueExternalId ? String(options.leagueExternalId) : 'leagues', error)
  }

  return report
}

export async function syncTeamAssetsFromApiFootball(
  supabase: DbClient,
  options: {
    leagueExternalId?: string | number | null
    teamExternalId?: string | number | null
    season?: number | null
    limit?: number
    force?: boolean
  } = {}
) {
  const report = createAssetSyncReport('teams')
  const limit = Math.max(1, Math.min(options.limit ?? 500, 1000))
  const force = Boolean(options.force)

  if (!options.teamExternalId && !options.leagueExternalId) return report

  try {
    const params = options.teamExternalId
      ? {
          id: options.teamExternalId,
        }
      : {
          league: options.leagueExternalId ?? undefined,
          season: options.season ?? new Date().getFullYear(),
        }
    const leagueId = await fetchLeagueIdByExternalId(supabase, options.leagueExternalId)
    const { payload } = await requestFootballApi<ApiFootballTeamRow[]>(
      '/teams',
      params,
      { logContext: 'sync-assets:teams' }
    )
    const apiRows = (payload.response ?? []).slice(0, limit)

    for (const apiRow of apiRows) {
      const team = apiRow.team
      const externalId = toExternalId(team?.id)
      if (!externalId) {
        report.skipped += 1
        continue
      }

      report.checked += 1
      const desiredLogoUrl = force
        ? pickTeamLogoUrl(null, externalId, team?.logo)
        : pickTeamLogoUrl(undefined, externalId, team?.logo)

      if (!desiredLogoUrl) {
        report.missing += 1
        continue
      }

      const { data: rows, error } = await supabase
        .from('teams')
        .select('id, external_id, name, logo_url, league_id')
        .eq('external_id', externalId)

      if (error) throw error

      const teamRows = (rows ?? []) as Array<{
        id: string
        external_id: string | number | null
        name: string | null
        logo_url: string | null
        league_id: string | null
      }>

      if (!teamRows.length) {
        await upsertTeamAssets(supabase, [
          {
            externalId,
            name: team?.name,
            logoUrl: team?.logo,
            leagueId,
          },
        ])
        report.updated += 1
        addAssetSyncSample(report, {
          externalId,
          name: team?.name ?? null,
          before: null,
          after: desiredLogoUrl,
          source: SOURCE,
        })
        continue
      }

      let changedAny = false

      for (const row of teamRows) {
        const nextLogoUrl = force
          ? desiredLogoUrl
          : pickTeamLogoUrl(row.logo_url, externalId, team?.logo)
        const shouldUpdate =
          shouldReplacePersistedAsset(row.logo_url, nextLogoUrl, force) ||
          Boolean(leagueId && !row.league_id)

        if (!shouldUpdate) continue

        const { error: updateError } = await supabase
          .from('teams')
          .update({
            name: row.name || team?.name || `Equipo ${externalId}`,
            league_id: row.league_id ?? leagueId,
            logo_url: nextLogoUrl,
            logo_source: SOURCE,
            logo_last_synced_at: new Date().toISOString(),
          })
          .eq('id', row.id)

        if (updateError) throw updateError
        changedAny = true
        addAssetSyncSample(report, {
          externalId,
          name: row.name ?? team?.name ?? null,
          before: row.logo_url,
          after: nextLogoUrl,
          source: SOURCE,
        })
      }

      if (changedAny) {
        report.updated += 1
      } else {
        report.skipped += 1
      }
    }
  } catch (error) {
    addAssetSyncError(
      report,
      options.teamExternalId
        ? String(options.teamExternalId)
        : `league:${options.leagueExternalId ?? 'unknown'}`,
      error
    )
  }

  return report
}

export async function syncPlayerAssetsFromApiFootball(
  supabase: DbClient,
  options: {
    leagueExternalId?: string | number | null
    teamExternalId?: string | number | null
    playerExternalId?: string | number | null
    season?: number | null
    limit?: number
  } = {}
) {
  const report = createAssetSyncReport('players')
  const limit = Math.max(1, Math.min(options.limit ?? 500, 1000))

  try {
    if (options.teamExternalId) {
      const { payload } = await requestFootballApi<ApiFootballSquadRow[]>(
        '/players/squads',
        { team: options.teamExternalId },
        { logContext: 'sync-assets:players-squad' }
      )
      const squads = payload.response ?? []
      const inputs: PlayerAssetInput[] = []
      const teamInputs: TeamAssetInput[] = []

      for (const squad of squads) {
        const teamExternalId = toExternalId(squad.team?.id) ?? toExternalId(options.teamExternalId)
        teamInputs.push({
          externalId: teamExternalId,
          name: squad.team?.name,
          logoUrl: squad.team?.logo,
        })

        for (const player of squad.players ?? []) {
          if (inputs.length >= limit) break

          inputs.push({
            externalId: player.id,
            name: player.name,
            teamExternalId,
            number: player.number ?? null,
            position: player.position ?? null,
            photoUrl: player.photo,
          })
        }
      }

      await upsertTeamAssets(supabase, teamInputs)
      const result = await upsertPlayerAssets(supabase, inputs)
      report.checked += result.processed
      report.updated += result.updated
      report.skipped += result.skipped
      report.missing += inputs.filter((input) => !pickStableAssetUrl(null, input.photoUrl, getApiSportsPlayerPhotoUrl(input.externalId))).length

      for (const input of inputs.slice(0, 12)) {
        addAssetSyncSample(report, {
          externalId: toExternalId(input.externalId),
          name: input.name ?? null,
          before: null,
          after: pickStableAssetUrl(null, input.photoUrl, getApiSportsPlayerPhotoUrl(input.externalId)),
          source: SOURCE,
        })
      }

      return report
    }

    if (options.playerExternalId && options.season) {
      const { payload } = await requestFootballApi<ApiFootballPlayerRow[]>(
        '/players',
        {
          id: options.playerExternalId,
          season: options.season,
          league: options.leagueExternalId ?? undefined,
        },
        { logContext: 'sync-assets:player' }
      )
      const inputs = (payload.response ?? []).slice(0, limit).map((row) => {
        const team = row.statistics?.find((stat) => stat.team?.id)?.team
        return {
          externalId: row.player?.id,
          name: row.player?.name,
          teamExternalId: team?.id,
          photoUrl: row.player?.photo,
        }
      })
      const result = await upsertPlayerAssets(supabase, inputs)
      report.checked += result.processed
      report.updated += result.updated
      report.skipped += result.skipped

      for (const input of inputs.slice(0, 12)) {
        addAssetSyncSample(report, {
          externalId: toExternalId(input.externalId),
          name: input.name ?? null,
          before: null,
          after: pickStableAssetUrl(null, input.photoUrl, getApiSportsPlayerPhotoUrl(input.externalId)),
          source: SOURCE,
        })
      }

      return report
    }
  } catch (error) {
    addAssetSyncError(
      report,
      options.playerExternalId
        ? String(options.playerExternalId)
        : `team:${options.teamExternalId ?? 'unknown'}`,
      error
    )
  }

  return report
}

function getLineupPlayers(lineups: MatchLineupLike[]) {
  const players: PlayerAssetInput[] = []

  for (const lineup of lineups) {
    const teamExternalId = toExternalId(lineup.team?.id)
    const wrappers = [...(lineup.startXI ?? []), ...(lineup.substitutes ?? [])]

    for (const wrapper of wrappers) {
      const player = wrapper.player
      const externalId = toExternalId(player?.id)
      if (!externalId) continue

      players.push({
        externalId,
        name: player?.name,
        teamExternalId,
        number: player?.number ?? null,
        position: player?.pos ?? player?.position ?? null,
        photoUrl: player?.photo,
      })
    }
  }

  return players
}

function enrichLineupPlayers<TPlayer extends PlayerLike>(
  players: PlayerWrapperLike<TPlayer>[] | undefined,
  photoMap: Map<string, string>
) {
  return (players ?? []).map((wrapper) => {
    const externalId = toExternalId(wrapper.player?.id)
    const photo = pickStableAssetUrl(
      externalId ? photoMap.get(externalId) : null,
      wrapper.player?.photo,
      getApiSportsPlayerPhotoUrl(externalId)
    )

    return {
      ...wrapper,
      player: wrapper.player
        ? {
            ...wrapper.player,
            photo: photo ?? undefined,
          }
        : wrapper.player,
    }
  })
}

export async function enrichMatchDetailAssets<
  TFixture extends MatchFixtureLike | null,
  TLineup extends MatchLineupLike,
>(fixture: TFixture, lineups: TLineup[]) {
  if (!fixture) return { fixture, lineups }

  try {
    const supabase = getSupabaseAdminClient()
    const leagueExternalId = toExternalId(fixture.league?.id)
    const homeExternalId = toExternalId(fixture.teams?.home?.id)
    const awayExternalId = toExternalId(fixture.teams?.away?.id)
    const lineupTeams = lineups.map((lineup) => ({
      externalId: lineup.team?.id,
      name: lineup.team?.name,
      logoUrl: lineup.team?.logo,
    }))

    await Promise.all([
      upsertLeagueAssets(supabase, [
        {
          externalId: leagueExternalId,
          name: fixture.league?.name,
          country: fixture.league?.country,
          season: fixture.league?.season,
          logoUrl: fixture.league?.logo,
        },
      ]),
      upsertTeamAssets(supabase, [
        {
          externalId: homeExternalId,
          name: fixture.teams?.home?.name,
          logoUrl: fixture.teams?.home?.logo,
        },
        {
          externalId: awayExternalId,
          name: fixture.teams?.away?.name,
          logoUrl: fixture.teams?.away?.logo,
        },
        ...lineupTeams,
      ]),
      upsertPlayerAssets(supabase, getLineupPlayers(lineups)),
    ])

    const [leagueLogoMap, teamLogoMap, playerPhotoMap] = await Promise.all([
      getPersistedLeagueLogoMap(supabase, [leagueExternalId]),
      getPersistedTeamLogoMap(supabase, [
        homeExternalId,
        awayExternalId,
        ...lineups.map((lineup) => lineup.team?.id),
      ]),
      getPersistedPlayerPhotoMap(
        supabase,
        getLineupPlayers(lineups).map((player) => player.externalId)
      ),
    ])

    const enrichedFixture = {
      ...fixture,
      league: fixture.league
        ? {
            ...fixture.league,
            logo: pickLeagueLogoUrl(
              leagueExternalId ? leagueLogoMap.get(leagueExternalId) : null,
              leagueExternalId,
              fixture.league.logo
            ) ?? undefined,
          }
        : fixture.league,
      teams: fixture.teams
        ? {
            ...fixture.teams,
            home: fixture.teams.home
              ? {
                  ...fixture.teams.home,
                  logo: pickTeamLogoUrl(
                    homeExternalId ? teamLogoMap.get(homeExternalId) : null,
                    homeExternalId,
                    fixture.teams.home.logo
                  ) ?? undefined,
                }
              : fixture.teams.home,
            away: fixture.teams.away
              ? {
                  ...fixture.teams.away,
                  logo: pickTeamLogoUrl(
                    awayExternalId ? teamLogoMap.get(awayExternalId) : null,
                    awayExternalId,
                    fixture.teams.away.logo
                  ) ?? undefined,
                }
              : fixture.teams.away,
          }
        : fixture.teams,
    } as TFixture

    const enrichedLineups = lineups.map((lineup) => {
      const teamExternalId = toExternalId(lineup.team?.id)
      return {
        ...lineup,
        team: lineup.team
          ? {
              ...lineup.team,
              logo: pickTeamLogoUrl(
                teamExternalId ? teamLogoMap.get(teamExternalId) : null,
                teamExternalId,
                lineup.team.logo
              ) ?? undefined,
            }
          : lineup.team,
        startXI: enrichLineupPlayers(lineup.startXI, playerPhotoMap),
        substitutes: enrichLineupPlayers(lineup.substitutes, playerPhotoMap),
      }
    }) as TLineup[]

    return { fixture: enrichedFixture, lineups: enrichedLineups }
  } catch (error) {
    console.warn('[assets] No se pudieron enriquecer assets del partido.', {
      fixtureId: fixture.fixture?.id ?? null,
      message: error instanceof Error ? error.message : String(error),
    })

    return { fixture, lineups }
  }
}

export async function persistFixtureListAssets(fixtures: MatchFixtureLike[]) {
  if (!fixtures.length) return { leagues: 0, teams: 0 }

  try {
    const supabase = getSupabaseAdminClient()
    const leagues = fixtures.map((fixture) => ({
      externalId: fixture.league?.id,
      name: fixture.league?.name,
      country: fixture.league?.country,
      season: fixture.league?.season,
      logoUrl: fixture.league?.logo,
    }))
    const teams = fixtures.flatMap((fixture) => [
      {
        externalId: fixture.teams?.home?.id,
        name: fixture.teams?.home?.name,
        logoUrl: fixture.teams?.home?.logo,
      },
      {
        externalId: fixture.teams?.away?.id,
        name: fixture.teams?.away?.name,
        logoUrl: fixture.teams?.away?.logo,
      },
    ])

    const [leagueResult, teamResult] = await Promise.all([
      upsertLeagueAssets(supabase, leagues),
      upsertTeamAssets(supabase, teams),
    ])

    return {
      leagues: leagueResult.updated,
      teams: teamResult.updated,
    }
  } catch (error) {
    console.warn('[assets] No se pudieron persistir assets de fixtures.', {
      fixtures: fixtures.length,
      message: error instanceof Error ? error.message : String(error),
    })

    return { leagues: 0, teams: 0 }
  }
}

export async function enrichTeamDetailAssets<
  TTeam extends { team?: TeamLike } | null,
  TSquad extends { team?: TeamLike; players?: PlayerLike[] } | null,
>(teamProfile: TTeam, squad: TSquad) {
  try {
    const supabase = getSupabaseAdminClient()
    const team = teamProfile?.team ?? squad?.team
    const teamExternalId = toExternalId(team?.id)
    const players = (squad?.players ?? []).map((player) => ({
      externalId: player.id,
      name: player.name,
      teamExternalId,
      number: player.number ?? null,
      position: player.position ?? player.pos ?? null,
      photoUrl: player.photo,
    }))

    await Promise.all([
      upsertTeamAssets(supabase, [
        {
          externalId: teamExternalId,
          name: team?.name,
          logoUrl: team?.logo,
        },
      ]),
      upsertPlayerAssets(supabase, players),
    ])

    const [teamLogoMap, playerPhotoMap] = await Promise.all([
      getPersistedTeamLogoMap(supabase, [teamExternalId]),
      getPersistedPlayerPhotoMap(supabase, players.map((player) => player.externalId)),
    ])
    const teamLogo = pickTeamLogoUrl(
      teamExternalId ? teamLogoMap.get(teamExternalId) : null,
      teamExternalId,
      team?.logo
    )
    const enrichedTeamProfile = teamProfile?.team
      ? {
          ...teamProfile,
          team: {
            ...teamProfile.team,
            logo: teamLogo ?? undefined,
          },
        }
      : teamProfile
    const enrichedSquad = squad
      ? {
          ...squad,
          team: squad.team
            ? {
                ...squad.team,
                logo: teamLogo ?? undefined,
              }
            : squad.team,
          players: (squad.players ?? []).map((player) => {
            const externalId = toExternalId(player.id)
            return {
              ...player,
              photo:
                pickStableAssetUrl(
                  externalId ? playerPhotoMap.get(externalId) : null,
                  player.photo,
                  getApiSportsPlayerPhotoUrl(externalId)
                ) ?? undefined,
            }
          }),
        }
      : squad

    return { team: enrichedTeamProfile as TTeam, squad: enrichedSquad as TSquad }
  } catch (error) {
    console.warn('[assets] No se pudieron enriquecer assets del equipo.', {
      teamId: teamProfile?.team?.id ?? squad?.team?.id ?? null,
      message: error instanceof Error ? error.message : String(error),
    })

    return { team: teamProfile, squad }
  }
}

export async function enrichTopPlayerAssets<
  TPlayer extends {
    playerId?: number
    name: string
    photo?: string
    teamId?: number
    teamName?: string
    teamLogo?: string
  },
>(players: TPlayer[]) {
  if (!players.length) return players

  try {
    const supabase = getSupabaseAdminClient()

    await Promise.all([
      upsertTeamAssets(
        supabase,
        players.map((player) => ({
          externalId: player.teamId,
          name: player.teamName,
          logoUrl: player.teamLogo,
        }))
      ),
      upsertPlayerAssets(
        supabase,
        players.map((player) => ({
          externalId: player.playerId,
          name: player.name,
          teamExternalId: player.teamId,
          photoUrl: player.photo,
        }))
      ),
    ])

    const [teamLogoMap, playerPhotoMap] = await Promise.all([
      getPersistedTeamLogoMap(supabase, players.map((player) => player.teamId)),
      getPersistedPlayerPhotoMap(supabase, players.map((player) => player.playerId)),
    ])

    return players.map((player) => {
      const playerExternalId = toExternalId(player.playerId)
      const teamExternalId = toExternalId(player.teamId)

      return {
        ...player,
        photo:
          pickStableAssetUrl(
            playerExternalId ? playerPhotoMap.get(playerExternalId) : null,
            player.photo,
            getApiSportsPlayerPhotoUrl(playerExternalId)
          ) ?? undefined,
        teamLogo:
          pickTeamLogoUrl(
            teamExternalId ? teamLogoMap.get(teamExternalId) : null,
            teamExternalId,
            player.teamLogo
          ) ?? undefined,
      }
    })
  } catch (error) {
    console.warn('[assets] No se pudieron enriquecer assets de goleadores.', {
      message: error instanceof Error ? error.message : String(error),
    })

    return players
  }
}

export async function enrichPlayerDetailAssets<
  TDetail extends {
    player: PlayerLike
    team?: TeamLike
    league?: LeagueLike
  } | null,
>(detail: TDetail) {
  if (!detail) return detail

  try {
    const supabase = getSupabaseAdminClient()

    await Promise.all([
      upsertTeamAssets(supabase, [
        {
          externalId: detail.team?.id,
          name: detail.team?.name,
          logoUrl: detail.team?.logo,
        },
      ]),
      upsertLeagueAssets(supabase, [
        {
          externalId: detail.league?.id,
          name: detail.league?.name,
          country: detail.league?.country,
          season: detail.league?.season,
          logoUrl: detail.league?.logo,
        },
      ]),
      upsertPlayerAssets(supabase, [
        {
          externalId: detail.player.id,
          name: detail.player.name,
          teamExternalId: detail.team?.id,
          photoUrl: detail.player.photo,
        },
      ]),
    ])

    const [teamLogoMap, leagueLogoMap, playerPhotoMap] = await Promise.all([
      getPersistedTeamLogoMap(supabase, [detail.team?.id]),
      getPersistedLeagueLogoMap(supabase, [detail.league?.id]),
      getPersistedPlayerPhotoMap(supabase, [detail.player.id]),
    ])
    const playerExternalId = toExternalId(detail.player.id)
    const teamExternalId = toExternalId(detail.team?.id)
    const leagueExternalId = toExternalId(detail.league?.id)

    return {
      ...detail,
      player: {
        ...detail.player,
        photo:
          pickStableAssetUrl(
            playerExternalId ? playerPhotoMap.get(playerExternalId) : null,
            detail.player.photo,
            getApiSportsPlayerPhotoUrl(playerExternalId)
          ) ?? undefined,
      },
      team: detail.team
        ? {
            ...detail.team,
            logo:
              pickTeamLogoUrl(
                teamExternalId ? teamLogoMap.get(teamExternalId) : null,
                teamExternalId,
                detail.team.logo
              ) ?? undefined,
          }
        : detail.team,
      league: detail.league
        ? {
            ...detail.league,
            logo:
              pickLeagueLogoUrl(
                leagueExternalId ? leagueLogoMap.get(leagueExternalId) : null,
                leagueExternalId,
                detail.league.logo
              ) ?? undefined,
          }
        : detail.league,
    } as TDetail
  } catch (error) {
    console.warn('[assets] No se pudieron enriquecer assets del jugador.', {
      playerId: detail.player.id ?? null,
      message: error instanceof Error ? error.message : String(error),
    })

    return detail
  }
}

export async function fillMissingAssetUrlsFromStaticSource(
  supabase: DbClient,
  scope: 'teams' | 'players' | 'leagues',
  limit = 500,
  filters: {
    leagueExternalId?: string | number | null
    teamId?: string | number | null
    playerId?: string | number | null
    force?: boolean
  } = {}
) {
  const syncedAt = new Date().toISOString()

  if (scope === 'teams') {
    let query = supabase
      .from('teams')
      .select('id, external_id, name, logo_url, league_id')
      .not('external_id', 'is', null)
      .limit(limit)

    if (filters.teamId) query = query.eq('external_id', String(filters.teamId))

    if (filters.leagueExternalId) {
      const { data: league } = await supabase
        .from('leagues')
        .select('id')
        .eq('external_id', String(filters.leagueExternalId))
        .maybeSingle()

      if (league?.id) query = query.eq('league_id', league.id)
    }

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as Array<{ id: string; external_id: string | number; logo_url: string | null }>
    let updated = 0

    for (const row of rows) {
      const logoUrl = pickTeamLogoUrl(filters.force ? null : row.logo_url, row.external_id)
      if (!logoUrl || logoUrl === row.logo_url) continue

      const { error: updateError } = await supabase
        .from('teams')
        .update({
          logo_url: logoUrl,
          logo_source: SOURCE,
          logo_last_synced_at: syncedAt,
        })
        .eq('id', row.id)

      if (updateError) throw updateError
      updated += 1
    }

    return { scope, processed: rows.length, updated }
  }

  if (scope === 'leagues') {
    let query = supabase
      .from('leagues')
      .select('id, external_id, name, logo_url')
      .not('external_id', 'is', null)
      .limit(limit)

    if (filters.leagueExternalId) query = query.eq('external_id', String(filters.leagueExternalId))

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as Array<{ id: string; external_id: string | number; logo_url: string | null }>
    let updated = 0

    for (const row of rows) {
      const overrideLogoUrl = getLeagueLogoOverrideUrl(row.external_id)
      const logoUrl = pickLeagueLogoUrl(filters.force ? null : row.logo_url, row.external_id)
      if (!logoUrl || logoUrl === row.logo_url) continue

      const { error: updateError } = await supabase
        .from('leagues')
        .update({
          logo_url: logoUrl,
          logo_source: overrideLogoUrl ? 'manual-override-2026' : SOURCE,
          logo_last_synced_at: syncedAt,
        })
        .eq('id', row.id)

      if (updateError) throw updateError
      updated += 1
    }

    return { scope, processed: rows.length, updated }
  }

  let query = supabase
    .from('players')
    .select('id, external_id, photo_url')
    .not('external_id', 'is', null)
    .limit(limit)

  if (filters.playerId) query = query.eq('external_id', String(filters.playerId))
  if (filters.teamId) query = query.eq('team_external_id', String(filters.teamId))

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as Array<{ id: string; external_id: string | number; photo_url: string | null }>
  let updated = 0

  for (const row of rows) {
    const photoUrl = pickStableAssetUrl(
      filters.force ? null : row.photo_url,
      null,
      getApiSportsPlayerPhotoUrl(row.external_id)
    )
    if (!photoUrl || photoUrl === row.photo_url) continue

    const { error: updateError } = await supabase
      .from('players')
      .update({
        photo_url: photoUrl,
        photo_source: SOURCE,
        photo_last_synced_at: syncedAt,
        updated_at: syncedAt,
      })
      .eq('id', row.id)

    if (updateError) throw updateError
    updated += 1
  }

  return { scope, processed: rows.length, updated }
}

async function probeRemoteAssetUrls(
  candidates: Array<{
    kind: 'team' | 'league' | 'player'
    id: string
    external_id: string | number | null
    name: string | null
    url: string
  }>,
  limit: number
) {
  const uniqueByUrl = new Map<string, (typeof candidates)[number]>()

  for (const candidate of candidates) {
    if (!uniqueByUrl.has(candidate.url)) uniqueByUrl.set(candidate.url, candidate)
    if (uniqueByUrl.size >= limit) break
  }

  const probes = await Promise.all(
    [...uniqueByUrl.values()].map(async (candidate) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3500)

      try {
        const response = await fetch(candidate.url, {
          method: 'HEAD',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (response.status === 405) return null
        if (response.ok) return null

        return {
          ...candidate,
          reason: 'remote-status',
          status: response.status,
        }
      } catch (error) {
        return {
          ...candidate,
          reason: error instanceof Error && error.name === 'AbortError' ? 'remote-timeout' : 'remote-error',
          status: null,
        }
      } finally {
        clearTimeout(timeout)
      }
    })
  )

  return probes.filter((probe): probe is NonNullable<typeof probe> => Boolean(probe))
}

export async function getAssetsAudit(
  options: {
    checkRemote?: boolean
    remoteLimit?: number
  } = {}
) {
  const supabase = getSupabaseAdminClient()

  type AuditTeamRow = {
    id: string
    external_id: string | number | null
    name: string | null
    logo_url: string | null
  }
  type AuditPlayerRow = {
    id: string
    external_id: string | number | null
    name: string | null
    team_external_id: string | number | null
    photo_url: string | null
  }
  type AuditLeagueRow = {
    id: string
    external_id: string | number | null
    name: string | null
    logo_url: string | null
  }

  const [teamRows, playerRows, leagueRows] = await Promise.all([
    fetchAllRows<AuditTeamRow>(supabase, 'teams', 'id, external_id, name, logo_url'),
    fetchAllRows<AuditPlayerRow>(
      supabase,
      'players',
      'id, external_id, name, team_external_id, photo_url'
    ),
    fetchAllRows<AuditLeagueRow>(supabase, 'leagues', 'id, external_id, name, logo_url'),
  ])
  const domains = new Map<string, number>()
  const brokenRemoteDomains = new Set<string>()
  const brokenUrls: Array<{
    kind: 'team' | 'league' | 'player'
    id: string
    external_id: string | number | null
    name: string | null
    url: string
    reason: string
    status?: number | null
  }> = []
  const remoteProbeCandidates: Array<{
    kind: 'team' | 'league' | 'player'
    id: string
    external_id: string | number | null
    name: string | null
    url: string
  }> = []
  const hasAssetUrl = (value: string | null | undefined) => Boolean(value?.trim())
  const normalizeName = (value: string | null | undefined) =>
    (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()

  const scanAssetRows = <
    TRow extends {
      id: string
      external_id: string | number | null
      name: string | null
    },
  >(
    kind: 'team' | 'league' | 'player',
    rows: TRow[],
    getUrl: (row: TRow) => string | null
  ) => {
    for (const row of rows) {
      const url = getUrl(row)
      if (url?.trim() && !normalizeAssetUrl(url)) {
        brokenUrls.push({
          kind,
          id: row.id,
          external_id: row.external_id,
          name: row.name,
          url,
          reason: 'invalid-url',
        })
        continue
      }

      const hostname = getAssetHostname(url)
      if (!hostname) continue
      const normalizedUrl = normalizeAssetUrl(url)
      if (!normalizedUrl) continue

      domains.set(hostname, (domains.get(hostname) ?? 0) + 1)
      remoteProbeCandidates.push({
        kind,
        id: row.id,
        external_id: row.external_id,
        name: row.name,
        url: normalizedUrl,
      })

      if (!isAllowedRemoteAssetHost(url)) {
        brokenRemoteDomains.add(hostname)
        brokenUrls.push({
          kind,
          id: row.id,
          external_id: row.external_id,
          name: row.name,
          url: normalizedUrl,
          reason: 'blocked-domain',
        })
      }
    }
  }

  scanAssetRows('team', teamRows, (row) => row.logo_url)
  scanAssetRows('league', leagueRows, (row) => row.logo_url)
  scanAssetRows('player', playerRows, (row) => row.photo_url)

  if (options.checkRemote) {
    brokenUrls.push(
      ...(await probeRemoteAssetUrls(
        remoteProbeCandidates,
        Math.max(1, Math.min(options.remoteLimit ?? 25, 150))
      ))
    )
  }
  const teamsWithLogo = teamRows.filter((row) => Boolean(row.logo_url?.trim())).length
  const playersWithPhoto = playerRows.filter((row) => Boolean(row.photo_url?.trim())).length
  const leaguesWithLogo = leagueRows.filter((row) => Boolean(row.logo_url?.trim())).length
  const legacyTeamLogoRows = teamRows.filter((row) => isLegacyApiFootballAssetUrl(row.logo_url))
  const legacyLeagueLogoRows = leagueRows.filter((row) => isLegacyApiFootballAssetUrl(row.logo_url))
  const teamAssetStatus = (
    externalId: string,
    names: string[]
  ) => {
    const normalizedNames = names.map(normalizeName)
    const row =
      teamRows.find((team) => String(team.external_id ?? '') === externalId) ??
      teamRows.find((team) => normalizedNames.includes(normalizeName(team.name)))

    if (!row) return null

    return {
      id: row.id,
      external_id: row.external_id ? String(row.external_id) : null,
      name: row.name,
      has_logo_url: hasAssetUrl(row.logo_url),
      logo_url: row.logo_url,
      domain: getAssetHostname(row.logo_url),
      allowed_remote_host: row.logo_url ? isAllowedRemoteAssetHost(row.logo_url) : false,
    }
  }
  const leagueAssetStatus = (
    externalId: string,
    names: string[]
  ) => {
    const normalizedNames = names.map(normalizeName)
    const row =
      leagueRows.find((league) => String(league.external_id ?? '') === externalId) ??
      leagueRows.find((league) => normalizedNames.some((name) => normalizeName(league.name).includes(name)))

    if (!row) return null

    return {
      id: row.id,
      external_id: row.external_id ? String(row.external_id) : null,
      name: row.name,
      has_logo_url: hasAssetUrl(row.logo_url),
      logo_url: row.logo_url,
      domain: getAssetHostname(row.logo_url),
      allowed_remote_host: row.logo_url ? isAllowedRemoteAssetHost(row.logo_url) : false,
    }
  }

  const teamMissingExamples = teamRows
    .filter((row) => !hasAssetUrl(row.logo_url))
    .slice(0, 10)
    .map((row) => ({
      id: row.id,
      externalId: row.external_id ? String(row.external_id) : null,
      name: row.name,
    }))
  const leagueMissingExamples = leagueRows
    .filter((row) => !hasAssetUrl(row.logo_url))
    .slice(0, 10)
    .map((row) => ({
      id: row.id,
      externalId: row.external_id ? String(row.external_id) : null,
      name: row.name,
    }))
  const playerMissingExamples = playerRows
    .filter((row) => !hasAssetUrl(row.photo_url))
    .slice(0, 10)
    .map((row) => ({
      id: row.id,
      externalId: row.external_id ? String(row.external_id) : null,
      teamExternalId: row.team_external_id ? String(row.team_external_id) : null,
      name: row.name,
    }))
  const sortedDomains = [...domains.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
  const knownAssets = {
    ligaProfesionalArgentina: leagueAssetStatus('128', ['Liga Profesional Argentina']),
    alwaysReady: teamAssetStatus('3700', ['Always Ready']),
    lanus: teamAssetStatus('446', ['Lanus', 'Lanús']),
    conmebolLibertadores: leagueAssetStatus('13', ['CONMEBOL Libertadores', 'Libertadores']),
  }

  return {
    teams: {
      total: teamRows.length,
      withLogo: teamsWithLogo,
      missingLogo: teamRows.length - teamsWithLogo,
      examplesMissing: teamMissingExamples,
      legacyApiFootballHost: legacyTeamLogoRows.length,
      legacyExamples: legacyTeamLogoRows.slice(0, 10).map((row) => ({
        id: row.id,
        externalId: row.external_id ? String(row.external_id) : null,
        name: row.name,
        logoUrl: row.logo_url,
      })),
      with_logo_url: teamsWithLogo,
      missing_logo_url: teamRows.length - teamsWithLogo,
      missing_examples: teamMissingExamples,
    },
    leagues: {
      total: leagueRows.length,
      withLogo: leaguesWithLogo,
      missingLogo: leagueRows.length - leaguesWithLogo,
      examplesMissing: leagueMissingExamples,
      legacyApiFootballHost: legacyLeagueLogoRows.length,
      legacyExamples: legacyLeagueLogoRows.slice(0, 10).map((row) => ({
        id: row.id,
        externalId: row.external_id ? String(row.external_id) : null,
        name: row.name,
        logoUrl: row.logo_url,
      })),
      with_logo_url: leaguesWithLogo,
      missing_logo_url: leagueRows.length - leaguesWithLogo,
      missing_examples: leagueMissingExamples,
    },
    players: {
      total: playerRows.length,
      withPhoto: playersWithPhoto,
      missingPhoto: playerRows.length - playersWithPhoto,
      examplesMissing: playerMissingExamples,
      with_photo_url: playersWithPhoto,
      missing_photo_url: playerRows.length - playersWithPhoto,
      missing_examples: playerMissingExamples,
    },
    brokenUrls,
    domains: sortedDomains,
    knownAssets,
    known_assets: {
      liga_profesional_argentina: knownAssets.ligaProfesionalArgentina,
      always_ready: knownAssets.alwaysReady,
      lanus: knownAssets.lanus,
      conmebol_libertadores: knownAssets.conmebolLibertadores,
    },
    broken_remote_domains_detected: [...brokenRemoteDomains],
    fallback_counts: {
      teams: teamRows.length - teamsWithLogo,
      players: playerRows.length - playersWithPhoto,
      leagues: leagueRows.length - leaguesWithLogo,
    },
    auditMode: {
      remoteChecked: Boolean(options.checkRemote),
      remoteLimit: Math.max(1, Math.min(options.remoteLimit ?? 25, 150)),
    },
  }
}
