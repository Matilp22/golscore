import type { SupabaseClient } from '@supabase/supabase-js'

import { fetchAllTeamLogoRows, type TeamLogoLookupRow } from '@/server/team-logo-lookup'

export type TeamIdentity = {
  id: string | null
  externalId: string | null
  name: string
  logoUrl: string | null
  source: 'external_id' | 'team_id' | 'override' | 'alias' | 'name_exact' | 'fallback'
  warnings: string[]
}

export type TeamIdentityInput = {
  name?: string | null
  externalId?: string | number | null
  teamId?: string | number | null
  country?: string | null
  leagueExternalId?: string | number | null
  season?: string | number | null
  context?: string | null
  aliases?: string[]
}

type IdentityOverride = {
  context: string | null
  source_name: string
  canonical_team_id: string | null
  canonical_team_external_id: string | null
  canonical_team_name: string
  country: string | null
  league_external_id: string | null
  reason: string | null
  verified: boolean | null
}

const VERIFIED_OVERRIDE_FALLBACKS: IdentityOverride[] = [
  {
    context: 'argentina-copa-argentina',
    source_name: 'Central Cordoba',
    canonical_team_id: null,
    canonical_team_external_id: '1065',
    canonical_team_name: 'Central Cordoba de Santiago',
    country: 'Argentina',
    league_external_id: '130',
    reason: 'Copa Argentina champion is Central Cordoba de Santiago del Estero.',
    verified: true,
  },
  {
    context: 'argentina-copa-argentina',
    source_name: 'Central Cordoba (SdE)',
    canonical_team_id: null,
    canonical_team_external_id: '1065',
    canonical_team_name: 'Central Cordoba de Santiago',
    country: 'Argentina',
    league_external_id: '130',
    reason: 'Verified Copa Argentina alias.',
    verified: true,
  },
  {
    context: 'argentina-copa-argentina',
    source_name: 'Arsenal',
    canonical_team_id: null,
    canonical_team_external_id: '459',
    canonical_team_name: 'Arsenal Sarandi',
    country: 'Argentina',
    league_external_id: '130',
    reason: 'Copa Argentina champion is Arsenal de Sarandi.',
    verified: true,
  },
  {
    context: 'internacional-sudamericana',
    source_name: 'Arsenal',
    canonical_team_id: null,
    canonical_team_external_id: '459',
    canonical_team_name: 'Arsenal Sarandi',
    country: 'Argentina',
    league_external_id: '11',
    reason: 'Sudamericana 2007 champion is Arsenal de Sarandi.',
    verified: true,
  },
  {
    context: 'internacional-champions',
    source_name: 'Arsenal',
    canonical_team_id: null,
    canonical_team_external_id: '42',
    canonical_team_name: 'Arsenal',
    country: 'England',
    league_external_id: '2',
    reason: 'UEFA Champions League finalist is Arsenal FC.',
    verified: true,
  },
  {
    context: 'internacional-europa-league',
    source_name: 'Arsenal',
    canonical_team_id: null,
    canonical_team_external_id: '42',
    canonical_team_name: 'Arsenal',
    country: 'England',
    league_external_id: '3',
    reason: 'UEFA Europa League finalist is Arsenal FC.',
    verified: true,
  },
  {
    context: 'internacional-champions',
    source_name: 'Inter',
    canonical_team_id: null,
    canonical_team_external_id: '505',
    canonical_team_name: 'Inter',
    country: 'Italy',
    league_external_id: '2',
    reason: 'UEFA Champions League Inter is Internazionale Milano.',
    verified: true,
  },
  {
    context: 'internacional-europa-league',
    source_name: 'Inter',
    canonical_team_id: null,
    canonical_team_external_id: '505',
    canonical_team_name: 'Inter',
    country: 'Italy',
    league_external_id: '3',
    reason: 'UEFA Europa League Inter is Internazionale Milano.',
    verified: true,
  },
  {
    context: 'internacional-champions',
    source_name: 'Juventus',
    canonical_team_id: null,
    canonical_team_external_id: '496',
    canonical_team_name: 'Juventus',
    country: 'Italy',
    league_external_id: '2',
    reason: 'UEFA Champions League Juventus is Juventus FC from Italy.',
    verified: true,
  },
  {
    context: 'internacional-champions',
    source_name: 'Tottenham Hotspur',
    canonical_team_id: null,
    canonical_team_external_id: '47',
    canonical_team_name: 'Tottenham',
    country: 'England',
    league_external_id: '2',
    reason: 'UEFA Champions League finalist is Tottenham Hotspur.',
    verified: true,
  },
  {
    context: 'internacional-europa-league',
    source_name: 'Tottenham Hotspur',
    canonical_team_id: null,
    canonical_team_external_id: '47',
    canonical_team_name: 'Tottenham',
    country: 'England',
    league_external_id: '3',
    reason: 'UEFA Europa League champion is Tottenham Hotspur.',
    verified: true,
  },
  {
    context: 'internacional-champions',
    source_name: 'Paris Saint Germain',
    canonical_team_id: null,
    canonical_team_external_id: '85',
    canonical_team_name: 'Paris Saint Germain',
    country: 'France',
    league_external_id: '2',
    reason: 'Verified PSG alias.',
    verified: true,
  },
]

const CANONICAL_ALIASES: Record<string, string[]> = {
  'central cordoba de santiago': [
    'central cordoba',
    'central cordoba sde',
    'central cordoba santiago',
    'central cordoba de santiago del estero',
    'central cordoba (sde)',
  ],
  'arsenal sarandi': ['arsenal de sarandi', 'arsenal sarandi'],
  'paris saint germain': ['psg', 'paris sg', 'paris saint-germain'],
  'inter': ['internazionale', 'inter milan', 'inter milano'],
  'tottenham': ['tottenham hotspur', 'spurs'],
  'bayern munchen': ['bayern munich', 'fc bayern munchen'],
  'atletico de madrid': ['atletico madrid'],
  'borussia dortmund': ['b dortmund'],
}

export function normalizeIdentityText(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toExternalKey(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized || null
}

function identityFromRow(
  row: TeamLogoLookupRow,
  source: TeamIdentity['source'],
  warnings: string[] = []
): TeamIdentity {
  return {
    id: row.id ? String(row.id) : null,
    externalId: row.external_id !== null && row.external_id !== undefined ? String(row.external_id) : null,
    name: row.name ?? 'A definir',
    logoUrl: row.logo_url ?? null,
    source,
    warnings,
  }
}

function fallbackIdentity(input: TeamIdentityInput, warnings: string[] = []): TeamIdentity {
  return {
    id: input.teamId !== null && input.teamId !== undefined ? String(input.teamId) : null,
    externalId: toExternalKey(input.externalId),
    name: input.name?.trim() || 'A definir',
    logoUrl: null,
    source: 'fallback',
    warnings,
  }
}

function overrideMatches(input: TeamIdentityInput, override: IdentityOverride) {
  if (!override.verified) return false

  const sourceName = normalizeIdentityText(input.name)
  if (!sourceName || sourceName !== normalizeIdentityText(override.source_name)) return false

  const context = normalizeIdentityText(input.context)
  const overrideContext = normalizeIdentityText(override.context)
  if (overrideContext && context && overrideContext !== context) return false
  if (overrideContext && !context) return false

  const leagueExternalId = toExternalKey(input.leagueExternalId)
  if (
    leagueExternalId &&
    override.league_external_id &&
    leagueExternalId !== String(override.league_external_id)
  ) {
    return false
  }

  return true
}

async function fetchIdentityOverrides(supabase: SupabaseClient): Promise<IdentityOverride[]> {
  const { data, error } = await supabase
    .from('team_identity_overrides')
    .select(
      'context, source_name, canonical_team_id, canonical_team_external_id, canonical_team_name, country, league_external_id, reason, verified'
    )
    .eq('verified', true)

  if (error) {
    const message = error.message?.toLowerCase() ?? ''
    if (error.code === '42P01' || error.code === 'PGRST205' || message.includes('schema cache')) {
      return VERIFIED_OVERRIDE_FALLBACKS
    }

    throw error
  }

  return [...VERIFIED_OVERRIDE_FALLBACKS, ...((data ?? []) as IdentityOverride[])]
}

function buildNameKeys(input: TeamIdentityInput) {
  const base = normalizeIdentityText(input.name)
  const keys = new Set<string>()
  if (base) keys.add(base)

  for (const alias of input.aliases ?? []) {
    const normalizedAlias = normalizeIdentityText(alias)
    if (normalizedAlias) keys.add(normalizedAlias)
  }

  for (const [canonical, aliases] of Object.entries(CANONICAL_ALIASES)) {
    if (base === normalizeIdentityText(canonical) || aliases.some((alias) => normalizeIdentityText(alias) === base)) {
      keys.add(normalizeIdentityText(canonical))
      aliases.forEach((alias) => keys.add(normalizeIdentityText(alias)))
    }
  }

  return [...keys]
}

function uniqueRows(rows: TeamLogoLookupRow[]) {
  const byId = new Map<string, TeamLogoLookupRow>()
  for (const row of rows) {
    byId.set(String(row.id), row)
  }

  return [...byId.values()]
}

export async function resolveTeamIdentity(
  supabase: SupabaseClient,
  input: TeamIdentityInput
): Promise<TeamIdentity> {
  const warnings: string[] = []
  const externalId = toExternalKey(input.externalId)

  if (externalId) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, external_id, name, logo_url')
      .eq('external_id', externalId)
      .maybeSingle()

    if (error) throw error
    if (data) return identityFromRow(data as TeamLogoLookupRow, 'external_id')

    warnings.push(`No se encontro team external_id=${externalId}.`)
  }

  const overrides = await fetchIdentityOverrides(supabase)
  const override = overrides.find((candidate) => overrideMatches(input, candidate))
  if (override) {
    if (override.canonical_team_external_id) {
      const { data, error } = await supabase
        .from('teams')
        .select('id, external_id, name, logo_url')
        .eq('external_id', override.canonical_team_external_id)
        .maybeSingle()

      if (error) throw error
      if (data) {
        return identityFromRow(data as TeamLogoLookupRow, 'override', [
          override.reason || `Override verificado para ${input.name}.`,
        ])
      }
    }

    if (override.canonical_team_id) {
      const { data, error } = await supabase
        .from('teams')
        .select('id, external_id, name, logo_url')
        .eq('id', override.canonical_team_id)
        .maybeSingle()

      if (error) throw error
      if (data) {
        return identityFromRow(data as TeamLogoLookupRow, 'override', [
          override.reason || `Override verificado para ${input.name}.`,
        ])
      }
    }

    warnings.push(`Override sin equipo resuelto: ${override.canonical_team_name}.`)
    return {
      id: override.canonical_team_id,
      externalId: override.canonical_team_external_id,
      name: override.canonical_team_name,
      logoUrl: override.canonical_team_external_id
        ? `https://media.api-sports.io/football/teams/${override.canonical_team_external_id}.png`
        : null,
      source: 'override',
      warnings,
    }
  }

  if (input.teamId !== null && input.teamId !== undefined) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, external_id, name, logo_url')
      .eq('id', String(input.teamId))
      .maybeSingle()

    if (error) throw error
    if (data) return identityFromRow(data as TeamLogoLookupRow, 'team_id')

    warnings.push(`No se encontro team_id=${input.teamId}.`)
  }

  const teams = await fetchAllTeamLogoRows(supabase)
  const keys = buildNameKeys(input)
  const matches = uniqueRows(
    teams.filter((team) => {
      const normalizedName = normalizeIdentityText(team.name)
      if (!normalizedName) return false
      if (keys.includes(normalizedName)) return true

      return Object.entries(CANONICAL_ALIASES).some(([canonical, aliases]) => {
        if (!keys.includes(normalizeIdentityText(canonical))) return false
        return aliases.map(normalizeIdentityText).includes(normalizedName)
      })
    })
  )

  if (matches.length === 1) {
    return identityFromRow(matches[0], keys.length > 1 ? 'alias' : 'name_exact')
  }

  if (matches.length > 1) {
    warnings.push(
      `Nombre ambiguo "${input.name}": ${matches
        .slice(0, 5)
        .map((team) => `${team.name} (${team.external_id ?? 'sin external_id'})`)
        .join(', ')}.`
    )
    return fallbackIdentity(input, warnings)
  }

  warnings.push(`No se encontro equipo para "${input.name ?? input.externalId ?? input.teamId ?? 'sin nombre'}".`)
  return fallbackIdentity(input, warnings)
}

export { VERIFIED_OVERRIDE_FALLBACKS }
