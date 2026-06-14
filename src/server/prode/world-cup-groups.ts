import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getLeagueStandings } from '@/lib/api-football'
import { readCachedLeagueStandings } from '@/server/football-standings-cache'
import type { LeagueStandingGroup, LeagueStandingRow } from '@/server/integrations/api-football'
import { WORLD_CUP_EXTERNAL_ID } from '@/shared/utils/league-rounds'
import {
  WORLD_CUP_GROUP_KEYS,
  getWorldCupGroupKey,
  getWorldCupGroupKeyFromRound,
  getWorldCupGroupLabel,
  isWorldCupGroupStageRound,
  normalizeWorldCupText,
  sortWorldCupGroupKeys,
  type WorldCupGroupKey,
} from '@/shared/utils/world-cup-groups'

export type WorldCupStandingRow = LeagueStandingRow

export type WorldCupStandingGroup = {
  group: WorldCupGroupKey
  label: string
  rows: WorldCupStandingRow[]
}

export type WorldCupMatchGroupInput = {
  round: string | number | null | undefined
  leagueExternalId?: string | number | null
  homeTeam?: {
    externalId?: string | number | null
    name?: string | null
  } | null
  awayTeam?: {
    externalId?: string | number | null
    name?: string | null
  } | null
}

export type WorldCupTeamGroupIndex = Map<string, WorldCupGroupKey>

export type WorldCupFixtureGroupInference = {
  teamGroupIndex: WorldCupTeamGroupIndex
  groups: Array<{
    group: WorldCupGroupKey
    label: string
    teamCount: number
  }>
  warnings: string[]
}

function teamIdentityKeys(input: { externalId?: string | number | null; name?: string | null }) {
  const keys: string[] = []

  if (input.externalId !== null && input.externalId !== undefined && input.externalId !== '') {
    keys.push(`external:${Number(input.externalId)}`)
    keys.push(`raw:${String(input.externalId).trim()}`)
  }

  const normalizedName = normalizeWorldCupText(input.name)
  if (normalizedName) keys.push(`name:${normalizedName}`)

  return keys
}

function getTeamGroup(
  team: WorldCupMatchGroupInput['homeTeam'],
  teamGroupIndex: WorldCupTeamGroupIndex
) {
  if (!team) return null

  for (const key of teamIdentityKeys(team)) {
    const group = teamGroupIndex.get(key)
    if (group) return group
  }

  return null
}

function getPrimaryTeamKey(team: WorldCupMatchGroupInput['homeTeam']) {
  if (!team) return null

  if (team.externalId !== null && team.externalId !== undefined && team.externalId !== '') {
    const numericExternalId = Number(team.externalId)

    return Number.isFinite(numericExternalId)
      ? `external:${numericExternalId}`
      : `raw:${String(team.externalId).trim()}`
  }

  const normalizedName = normalizeWorldCupText(team.name)

  return normalizedName ? `name:${normalizedName}` : null
}

class TeamUnionFind {
  private parents = new Map<string, string>()

  add(key: string) {
    if (!this.parents.has(key)) {
      this.parents.set(key, key)
    }
  }

  find(key: string): string {
    const parent = this.parents.get(key)

    if (!parent || parent === key) return key

    const root = this.find(parent)
    this.parents.set(key, root)

    return root
  }

  union(a: string, b: string) {
    this.add(a)
    this.add(b)

    const rootA = this.find(a)
    const rootB = this.find(b)

    if (rootA !== rootB) {
      this.parents.set(rootB, rootA)
    }
  }
}

function mapGroups(groups: LeagueStandingGroup[]) {
  return groups
    .map((group) => {
      const parsedGroupKey = getWorldCupGroupKey(group.name)

      if (!parsedGroupKey) return null

      return {
        group: parsedGroupKey,
        label: getWorldCupGroupLabel(parsedGroupKey),
        rows: group.rows,
      } satisfies WorldCupStandingGroup
    })
    .filter((group): group is WorldCupStandingGroup => Boolean(group))
    .sort((a, b) => sortWorldCupGroupKeys([a.group, b.group])[0] === a.group ? -1 : 1)
}

export async function getWorldCupGroupStandings(
  season = 2026,
  options: { includeOfficialFallback?: boolean } = {}
) {
  if (options.includeOfficialFallback) {
    return mapGroups(await getLeagueStandings(WORLD_CUP_EXTERNAL_ID, season))
  }

  const supabase = getSupabaseAdminClient()
  const cachedGroups = await readCachedLeagueStandings(supabase, WORLD_CUP_EXTERNAL_ID, season)

  return mapGroups(cachedGroups)
}

export function inferWorldCupGroupsFromFixtures(
  matches: WorldCupMatchGroupInput[]
): WorldCupFixtureGroupInference {
  const warnings: string[] = []
  const unionFind = new TeamUnionFind()
  const teamByPrimaryKey = new Map<
    string,
    NonNullable<WorldCupMatchGroupInput['homeTeam']>
  >()
  const firstSeenByPrimaryKey = new Map<string, number>()

  matches.forEach((match, index) => {
    if (!isWorldCupGroupStageRound(match.round, match.leagueExternalId)) return

    const homeKey = getPrimaryTeamKey(match.homeTeam)
    const awayKey = getPrimaryTeamKey(match.awayTeam)

    if (!homeKey || !awayKey || !match.homeTeam || !match.awayTeam) return

    unionFind.union(homeKey, awayKey)
    teamByPrimaryKey.set(homeKey, match.homeTeam)
    teamByPrimaryKey.set(awayKey, match.awayTeam)

    if (!firstSeenByPrimaryKey.has(homeKey)) firstSeenByPrimaryKey.set(homeKey, index)
    if (!firstSeenByPrimaryKey.has(awayKey)) firstSeenByPrimaryKey.set(awayKey, index)
  })

  const components = new Map<
    string,
    {
      keys: string[]
      firstSeen: number
    }
  >()

  for (const key of teamByPrimaryKey.keys()) {
    const root = unionFind.find(key)
    const current = components.get(root) ?? {
      keys: [],
      firstSeen: Number.MAX_SAFE_INTEGER,
    }

    current.keys.push(key)
    current.firstSeen = Math.min(
      current.firstSeen,
      firstSeenByPrimaryKey.get(key) ?? Number.MAX_SAFE_INTEGER
    )
    components.set(root, current)
  }

  const sortedComponents = [...components.values()]
    .filter((component) => component.keys.length > 0)
    .sort((a, b) => a.firstSeen - b.firstSeen)

  if (!sortedComponents.length) {
    return { teamGroupIndex: new Map(), groups: [], warnings }
  }

  const unsafeComponents = sortedComponents.filter(
    (component) => component.keys.length < 3 || component.keys.length > 4
  )

  if (sortedComponents.length > WORLD_CUP_GROUP_KEYS.length || unsafeComponents.length) {
    warnings.push(
      'No se pudo inferir grupos del Mundial con seguridad desde fixtures; se esperan hasta 12 grupos de 3 o 4 equipos.'
    )

    return { teamGroupIndex: new Map(), groups: [], warnings }
  }

  const teamGroupIndex: WorldCupTeamGroupIndex = new Map()
  const groups = sortedComponents.map((component, index) => {
    const group = WORLD_CUP_GROUP_KEYS[index]

    for (const primaryKey of component.keys) {
      const team = teamByPrimaryKey.get(primaryKey)
      if (!team) continue

      for (const key of teamIdentityKeys(team)) {
        teamGroupIndex.set(key, group)
      }
    }

    return {
      group,
      label: getWorldCupGroupLabel(group),
      teamCount: component.keys.length,
    }
  })

  return { teamGroupIndex, groups, warnings }
}

export function buildWorldCupTeamGroupIndex(groups: WorldCupStandingGroup[]) {
  const index: WorldCupTeamGroupIndex = new Map()

  for (const group of groups) {
    for (const row of group.rows) {
      for (const key of teamIdentityKeys({
        externalId: row.teamId ?? null,
        name: row.teamName,
      })) {
        index.set(key, group.group)
      }
    }
  }

  return index
}

export function resolveWorldCupMatchGroup(
  match: WorldCupMatchGroupInput,
  teamGroupIndex: WorldCupTeamGroupIndex
) {
  if (!isWorldCupGroupStageRound(match.round, match.leagueExternalId)) return null

  const homeGroup = getTeamGroup(match.homeTeam, teamGroupIndex)
  const awayGroup = getTeamGroup(match.awayTeam, teamGroupIndex)

  if (homeGroup && awayGroup && homeGroup === awayGroup) return homeGroup
  if (homeGroup && !awayGroup) return homeGroup
  if (awayGroup && !homeGroup) return awayGroup

  const roundGroup = getWorldCupGroupKeyFromRound(match.round)
  if (roundGroup) return roundGroup

  return null
}

export function getWorldCupGroupStandingsMap(groups: WorldCupStandingGroup[]) {
  return new Map(groups.map((group) => [group.group, group]))
}
