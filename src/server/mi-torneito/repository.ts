import 'server-only'

import {
  getAdminClient,
  normalizeSearch,
  toAdminDataError,
  type AdminDataError,
} from '@/server/admin/shared'
import { computeMiTorneitoStandings } from '@/server/mi-torneito/standings'
import type {
  MiTorneitoAdminRole,
  MiTorneitoDataResult,
  MiTorneitoMatch,
  MiTorneitoMatchStatus,
  MiTorneitoOrganization,
  MiTorneitoRound,
  MiTorneitoRoundPhase,
  MiTorneitoTeam,
  MiTorneitoTournament,
  MiTorneitoTournamentAdmin,
  MiTorneitoTournamentBundle,
  MiTorneitoTournamentRequest,
  MiTorneitoTournamentStatus,
  MiTorneitoVisibility,
} from '@/shared/mi-torneito/types'
import { slugifyMiTorneito } from '@/shared/mi-torneito/utils'

type OrganizationRow = {
  id: string
  name: string
  slug: string
  city: string | null
  contact_email: string | null
  contact_phone: string | null
  active: boolean | null
}

type TournamentRequestRow = {
  id: string
  organizer_name: string
  organizer_email: string
  organizer_phone: string | null
  tournament_name: string
  city: string | null
  expected_teams: number | null
  notes: string | null
  status: MiTorneitoTournamentRequest['status']
  admin_notes: string | null
  reviewed_at: string | null
  created_at: string
}

type TournamentRow = {
  id: string
  organization_id: string | null
  name: string
  slug: string
  short_description: string | null
  city: string | null
  venue: string | null
  season: string | null
  format: string | null
  status: MiTorneitoTournamentStatus
  visibility: MiTorneitoVisibility
  starts_on: string | null
  ends_on: string | null
  logo_url: string | null
  cover_url: string | null
  points_win: number | null
  points_draw: number | null
  points_loss: number | null
  created_at: string
  updated_at: string
}

type TeamRow = {
  id: string
  tournament_id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string | null
  coach_name: string | null
  home_venue: string | null
  active: boolean | null
  created_at: string
}

type RoundRow = {
  id: string
  tournament_id: string
  name: string
  slug: string
  phase: MiTorneitoRoundPhase
  sort_order: number | null
}

type MatchRow = {
  id: string
  tournament_id: string
  round_id: string | null
  home_team_id: string | null
  away_team_id: string | null
  scheduled_at: string | null
  venue: string | null
  status: MiTorneitoMatchStatus
  home_score: number | null
  away_score: number | null
  home_penalty_score: number | null
  away_penalty_score: number | null
  minute: number | null
  broadcast_label: string | null
  notes: string | null
  created_at: string
}

type AdminRow = {
  id: string
  tournament_id: string
  user_id: string | null
  email: string
  role: MiTorneitoAdminRole
  active: boolean | null
  invited_at: string
}

export type MiTorneitoRequestInput = {
  organizerName: string
  organizerEmail: string
  organizerPhone?: string | null
  tournamentName: string
  city?: string | null
  expectedTeams?: number | null
  notes?: string | null
}

export type MiTorneitoTournamentCreateInput = {
  requestId?: string | null
  organizationName: string
  organizationCity?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  tournamentName: string
  shortDescription?: string | null
  city?: string | null
  venue?: string | null
  season?: string | null
  format?: string | null
  status: MiTorneitoTournamentStatus
  visibility: MiTorneitoVisibility
  startsOn?: string | null
  endsOn?: string | null
  adminEmail?: string | null
  actorUserId?: string | null
  actorEmail?: string | null
}

export type MiTorneitoTeamInput = {
  tournamentId: string
  name: string
  logoUrl?: string | null
  primaryColor?: string | null
  coachName?: string | null
  homeVenue?: string | null
}

export type MiTorneitoRoundInput = {
  tournamentId: string
  name: string
  phase: MiTorneitoRoundPhase
  sortOrder: number
}

export type MiTorneitoMatchInput = {
  tournamentId: string
  roundId?: string | null
  homeTeamId?: string | null
  awayTeamId?: string | null
  scheduledAt?: string | null
  venue?: string | null
  status: MiTorneitoMatchStatus
  broadcastLabel?: string | null
  notes?: string | null
}

export type MiTorneitoMatchResultInput = {
  matchId: string
  status: MiTorneitoMatchStatus
  homeScore?: number | null
  awayScore?: number | null
  homePenaltyScore?: number | null
  awayPenaltyScore?: number | null
  minute?: number | null
}

function emptyResult<T>(data: T, error: unknown, message: string): MiTorneitoDataResult<T> {
  const adminError = toAdminDataError(error, message)

  return {
    data,
    error: {
      message: adminError.message,
      setupRequired: adminError.setupRequired,
    },
  }
}

function dataResult<T>(data: T): MiTorneitoDataResult<T> {
  return { data, error: null }
}

function mapOrganization(row: OrganizationRow): MiTorneitoOrganization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    city: row.city,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    active: row.active ?? true,
  }
}

function mapRequest(row: TournamentRequestRow): MiTorneitoTournamentRequest {
  return {
    id: row.id,
    organizerName: row.organizer_name,
    organizerEmail: row.organizer_email,
    organizerPhone: row.organizer_phone,
    tournamentName: row.tournament_name,
    city: row.city,
    expectedTeams: row.expected_teams,
    notes: row.notes,
    status: row.status,
    adminNotes: row.admin_notes,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  }
}

function mapTournament(row: TournamentRow): MiTorneitoTournament {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.short_description,
    city: row.city,
    venue: row.venue,
    season: row.season,
    format: row.format,
    status: row.status,
    visibility: row.visibility,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    logoUrl: row.logo_url,
    coverUrl: row.cover_url,
    pointsWin: row.points_win ?? 3,
    pointsDraw: row.points_draw ?? 1,
    pointsLoss: row.points_loss ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTeam(row: TeamRow): MiTorneitoTeam {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    coachName: row.coach_name,
    homeVenue: row.home_venue,
    active: row.active ?? true,
    createdAt: row.created_at,
  }
}

function mapRound(row: RoundRow): MiTorneitoRound {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    name: row.name,
    slug: row.slug,
    phase: row.phase,
    sortOrder: row.sort_order ?? 0,
  }
}

function mapMatch(row: MatchRow): MiTorneitoMatch {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    roundId: row.round_id,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    scheduledAt: row.scheduled_at,
    venue: row.venue,
    status: row.status,
    homeScore: row.home_score,
    awayScore: row.away_score,
    homePenaltyScore: row.home_penalty_score,
    awayPenaltyScore: row.away_penalty_score,
    minute: row.minute,
    broadcastLabel: row.broadcast_label,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

function mapAdmin(row: AdminRow): MiTorneitoTournamentAdmin {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    userId: row.user_id,
    email: row.email,
    role: row.role,
    active: row.active ?? true,
    invitedAt: row.invited_at,
  }
}

function buildBundle(input: {
  organization: MiTorneitoOrganization | null
  tournament: MiTorneitoTournament
  teams: MiTorneitoTeam[]
  rounds: MiTorneitoRound[]
  matches: MiTorneitoMatch[]
  admins?: MiTorneitoTournamentAdmin[]
}): MiTorneitoTournamentBundle {
  return {
    ...input,
    standings: computeMiTorneitoStandings({
      tournament: input.tournament,
      teams: input.teams,
      matches: input.matches,
    }),
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function withMiTorneitoQueryTimeout<T>(
  promise: PromiseLike<T>,
  label = 'Supabase'
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} no respondio a tiempo. Probá de nuevo en unos segundos.`))
    }, 4500)
  })

  try {
    return await Promise.race([Promise.resolve(promise), timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function createUniqueSlug(table: string, baseValue: string, fallback: string) {
  const supabase = getAdminClient()
  const baseSlug = slugifyMiTorneito(baseValue, fallback)
  const { data, error } = await withMiTorneitoQueryTimeout(
    supabase
      .from(table)
      .select('slug')
      .like('slug', `${baseSlug}%`),
    `Consulta de slug ${table}`
  )

  if (error) throw error

  const used = new Set(((data ?? []) as Array<{ slug: string }>).map((row) => row.slug))
  if (!used.has(baseSlug)) return baseSlug

  let index = 2
  while (used.has(`${baseSlug}-${index}`)) index += 1

  return `${baseSlug}-${index}`
}

export async function listPublicMiTorneitoTournaments(limit = 8) {
  const fallback: MiTorneitoTournament[] = []

  try {
    const supabase = getAdminClient()
    const { data, error } = await withMiTorneitoQueryTimeout(
      supabase
        .from('mi_torneito_tournaments')
        .select('*')
        .is('deleted_at', null)
        .in('visibility', ['public', 'unlisted'])
        .order('starts_on', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit),
      'Lectura de torneos publicos'
    )

    if (error) return emptyResult(fallback, error, 'No se pudieron leer torneos de Mi Torneito.')

    return dataResult(((data ?? []) as TournamentRow[]).map(mapTournament))
  } catch (error) {
    return emptyResult(fallback, error, 'No se pudieron leer torneos de Mi Torneito.')
  }
}

export async function listAllMiTorneitoTournaments() {
  const fallback: MiTorneitoTournament[] = []

  try {
    const supabase = getAdminClient()
    const { data, error } = await withMiTorneitoQueryTimeout(
      supabase
        .from('mi_torneito_tournaments')
        .select('*')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false }),
      'Lectura de torneos admin'
    )

    if (error) return emptyResult(fallback, error, 'No se pudieron leer torneos.')

    return dataResult(((data ?? []) as TournamentRow[]).map(mapTournament))
  } catch (error) {
    return emptyResult(fallback, error, 'No se pudieron leer torneos.')
  }
}

export async function listMiTorneitoRequests(query = '') {
  const fallback: MiTorneitoTournamentRequest[] = []

  try {
    const supabase = getAdminClient()
    const { data, error } = await withMiTorneitoQueryTimeout(
      supabase
        .from('mi_torneito_tournament_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
      'Lectura de solicitudes'
    )

    if (error) return emptyResult(fallback, error, 'No se pudieron leer solicitudes.')

    const normalizedQuery = normalizeSearch(query)
    const requests = ((data ?? []) as TournamentRequestRow[])
      .map(mapRequest)
      .filter((request) => {
        if (!normalizedQuery) return true

        return normalizeSearch([
          request.tournamentName,
          request.organizerName,
          request.organizerEmail,
          request.city,
          request.status,
        ].filter(Boolean).join(' ')).includes(normalizedQuery)
      })

    return dataResult(requests)
  } catch (error) {
    return emptyResult(fallback, error, 'No se pudieron leer solicitudes.')
  }
}

export async function getMiTorneitoAdminSummary() {
  const fallback = {
    pendingRequests: 0,
    activeTournaments: 0,
    totalTeams: 0,
    upcomingMatches: 0,
  }

  try {
    const [requests, tournaments] = await Promise.all([
      listMiTorneitoRequests(),
      listAllMiTorneitoTournaments(),
    ])

    if (requests.error) return emptyResult(fallback, requests.error, requests.error.message)
    if (tournaments.error) return emptyResult(fallback, tournaments.error, tournaments.error.message)

    const bundles = await Promise.all(
      tournaments.data.slice(0, 100).map((tournament) => getMiTorneitoTournamentBundleById(tournament.id))
    )
    const validBundles = bundles
      .filter((result): result is { data: MiTorneitoTournamentBundle; error: null } =>
        !result.error && Boolean(result.data)
      )

    return dataResult({
      pendingRequests: requests.data.filter((request) => request.status === 'pending').length,
      activeTournaments: tournaments.data.filter((tournament) => tournament.status === 'active').length,
      totalTeams: validBundles.reduce((count, result) => count + result.data.teams.length, 0),
      upcomingMatches: validBundles.reduce(
        (count, result) =>
          count + result.data.matches.filter((match) => match.status === 'scheduled').length,
        0
      ),
    })
  } catch (error) {
    return emptyResult(fallback, error, 'No se pudo cargar el resumen de Mi Torneito.')
  }
}

async function getTournamentBundle(
  tournament: MiTorneitoTournament,
  includeAdmins = false
): Promise<MiTorneitoDataResult<MiTorneitoTournamentBundle>> {
  const fallback = buildBundle({
    organization: null,
    tournament,
    teams: [],
    rounds: [],
    matches: [],
    admins: includeAdmins ? [] : undefined,
  })

  try {
    const supabase = getAdminClient()
    const [organizationResult, teamsResult, roundsResult, matchesResult, adminsResult] =
      await Promise.all([
        tournament.organizationId
          ? withMiTorneitoQueryTimeout(
              supabase
                .from('mi_torneito_organizations')
                .select('*')
                .eq('id', tournament.organizationId)
                .maybeSingle(),
              'Lectura de organizacion'
            )
          : Promise.resolve({ data: null, error: null }),
        withMiTorneitoQueryTimeout(
          supabase
            .from('mi_torneito_teams')
            .select('*')
            .eq('tournament_id', tournament.id)
            .order('name', { ascending: true }),
          'Lectura de equipos'
        ),
        withMiTorneitoQueryTimeout(
          supabase
            .from('mi_torneito_rounds')
            .select('*')
            .eq('tournament_id', tournament.id)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true }),
          'Lectura de rondas'
        ),
        withMiTorneitoQueryTimeout(
          supabase
            .from('mi_torneito_matches')
            .select('*')
            .eq('tournament_id', tournament.id)
            .order('scheduled_at', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true }),
          'Lectura de partidos'
        ),
        includeAdmins
          ? withMiTorneitoQueryTimeout(
              supabase
                .from('mi_torneito_tournament_admins')
                .select('*')
                .eq('tournament_id', tournament.id)
                .order('created_at', { ascending: false }),
              'Lectura de administradores'
            )
          : Promise.resolve({ data: [], error: null }),
      ])

    const firstError =
      organizationResult.error ||
      teamsResult.error ||
      roundsResult.error ||
      matchesResult.error ||
      adminsResult.error

    if (firstError) return emptyResult(fallback, firstError, 'No se pudo cargar el torneo.')

    return dataResult(
      buildBundle({
        organization: organizationResult.data
          ? mapOrganization(organizationResult.data as OrganizationRow)
          : null,
        tournament,
        teams: ((teamsResult.data ?? []) as TeamRow[]).map(mapTeam),
        rounds: ((roundsResult.data ?? []) as RoundRow[]).map(mapRound),
        matches: ((matchesResult.data ?? []) as MatchRow[]).map(mapMatch),
        admins: includeAdmins
          ? ((adminsResult.data ?? []) as AdminRow[]).map(mapAdmin)
          : undefined,
      })
    )
  } catch (error) {
    return emptyResult(fallback, error, 'No se pudo cargar el torneo.')
  }
}

export async function getPublicMiTorneitoTournamentBundle(slug: string) {
  const fallback: MiTorneitoTournamentBundle | null = null

  try {
    const supabase = getAdminClient()
    const { data, error } = await withMiTorneitoQueryTimeout(
      supabase
        .from('mi_torneito_tournaments')
        .select('*')
        .eq('slug', slug)
        .is('deleted_at', null)
        .in('visibility', ['public', 'unlisted'])
        .maybeSingle(),
      'Lectura de torneo publico'
    )

    if (error) return emptyResult(fallback, error, 'No se pudo leer el torneo.')
    if (!data) return dataResult(null)

    return getTournamentBundle(mapTournament(data as TournamentRow))
  } catch (error) {
    return emptyResult(fallback, error, 'No se pudo leer el torneo.')
  }
}

export async function getMiTorneitoTournamentBundleById(id: string, includeAdmins = false) {
  const fallback: MiTorneitoTournamentBundle | null = null

  try {
    const supabase = getAdminClient()
    const { data, error } = await withMiTorneitoQueryTimeout(
      supabase
        .from('mi_torneito_tournaments')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle(),
      'Lectura de torneo por id'
    )

    if (error) return emptyResult(fallback, error, 'No se pudo leer el torneo.')
    if (!data) return dataResult(null)

    return getTournamentBundle(mapTournament(data as TournamentRow), includeAdmins)
  } catch (error) {
    return emptyResult(fallback, error, 'No se pudo leer el torneo.')
  }
}

export async function listTournamentsForAdminEmail(email: string) {
  const fallback: MiTorneitoTournamentBundle[] = []

  try {
    const supabase = getAdminClient()
    const normalizedEmail = normalizeEmail(email)
    const { data, error } = await withMiTorneitoQueryTimeout(
      supabase
        .from('mi_torneito_tournament_admins')
        .select('tournament_id')
        .eq('active', true)
        .ilike('email', normalizedEmail),
      'Lectura de torneos asignados'
    )

    if (error) return emptyResult(fallback, error, 'No se pudieron leer tus torneos.')

    const tournamentIds = Array.from(new Set(((data ?? []) as Array<{ tournament_id: string }>).map((row) => row.tournament_id)))
    const bundles = await Promise.all(
      tournamentIds.map((tournamentId) => getMiTorneitoTournamentBundleById(tournamentId, true))
    )

    return dataResult(
      bundles
        .filter((result): result is { data: MiTorneitoTournamentBundle; error: null } =>
          !result.error && Boolean(result.data)
        )
        .map((result) => result.data)
    )
  } catch (error) {
    return emptyResult(fallback, error, 'No se pudieron leer tus torneos.')
  }
}

export async function createMiTorneitoTournamentRequest(input: MiTorneitoRequestInput) {
  const supabase = getAdminClient()
  const { error } = await withMiTorneitoQueryTimeout(
    supabase
      .from('mi_torneito_tournament_requests')
      .insert({
        organizer_name: input.organizerName,
        organizer_email: normalizeEmail(input.organizerEmail),
        organizer_phone: input.organizerPhone || null,
        tournament_name: input.tournamentName,
        city: input.city || null,
        expected_teams: input.expectedTeams ?? null,
        notes: input.notes || null,
        status: 'pending',
      }),
    'Envio de solicitud'
  )

  if (error) throw new Error(`No se pudo enviar la solicitud: ${error.message}`)
}

export async function updateMiTorneitoRequestStatus(input: {
  requestId: string
  status: MiTorneitoTournamentRequest['status']
  adminNotes?: string | null
  reviewedBy?: string | null
}) {
  const supabase = getAdminClient()
  const { error } = await withMiTorneitoQueryTimeout(
    supabase
      .from('mi_torneito_tournament_requests')
      .update({
        status: input.status,
        admin_notes: input.adminNotes || null,
        reviewed_by: input.reviewedBy || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', input.requestId),
    'Actualizacion de solicitud'
  )

  if (error) throw new Error(`No se pudo actualizar la solicitud: ${error.message}`)
}

export async function createMiTorneitoTournament(input: MiTorneitoTournamentCreateInput) {
  const supabase = getAdminClient()
  const organizationSlug = await createUniqueSlug(
    'mi_torneito_organizations',
    input.organizationName,
    'organizacion'
  )
  const tournamentSlug = await createUniqueSlug(
    'mi_torneito_tournaments',
    input.tournamentName,
    'torneo'
  )

  const { data: organizationData, error: organizationError } = await withMiTorneitoQueryTimeout(
    supabase
      .from('mi_torneito_organizations')
      .insert({
        name: input.organizationName,
        slug: organizationSlug,
        city: input.organizationCity || input.city || null,
        contact_email: input.contactEmail ? normalizeEmail(input.contactEmail) : null,
        contact_phone: input.contactPhone || null,
        created_by: input.actorUserId || null,
      })
      .select('*')
      .single(),
    'Creacion de organizacion'
  )

  if (organizationError) {
    throw new Error(`No se pudo crear la organizacion: ${organizationError.message}`)
  }

  const organization = mapOrganization(organizationData as OrganizationRow)
  const { data: tournamentData, error: tournamentError } = await withMiTorneitoQueryTimeout(
    supabase
      .from('mi_torneito_tournaments')
      .insert({
        organization_id: organization.id,
        name: input.tournamentName,
        slug: tournamentSlug,
        short_description: input.shortDescription || null,
        city: input.city || input.organizationCity || null,
        venue: input.venue || null,
        season: input.season || null,
        format: input.format || null,
        status: input.status,
        visibility: input.visibility,
        starts_on: input.startsOn || null,
        ends_on: input.endsOn || null,
        created_by: input.actorUserId || null,
      })
      .select('*')
      .single(),
    'Creacion de torneo'
  )

  if (tournamentError) {
    throw new Error(`No se pudo crear el torneo: ${tournamentError.message}`)
  }

  const tournament = mapTournament(tournamentData as TournamentRow)

  if (input.adminEmail) {
    await assignMiTorneitoTournamentAdmin({
      tournamentId: tournament.id,
      email: input.adminEmail,
      role: 'owner',
      actorUserId: input.actorUserId ?? null,
    })
  }

  if (input.requestId) {
    await updateMiTorneitoRequestStatus({
      requestId: input.requestId,
      status: 'approved',
      adminNotes: 'Torneo creado desde el panel admin.',
      reviewedBy: input.actorUserId ?? null,
    })
  }

  await writeMiTorneitoAuditLog({
    tournamentId: tournament.id,
    actorUserId: input.actorUserId ?? null,
    actorEmail: input.actorEmail ?? null,
    action: 'create_tournament',
    entityType: 'tournament',
    entityId: tournament.id,
    metadata: {
      organizationId: organization.id,
      requestId: input.requestId ?? null,
    },
  })

  return tournament
}

export async function createMiTorneitoTeam(input: MiTorneitoTeamInput) {
  const supabase = getAdminClient()
  const slug = await createTeamSlug(input.tournamentId, input.name)
  const { data, error } = await withMiTorneitoQueryTimeout(
    supabase
      .from('mi_torneito_teams')
      .insert({
        tournament_id: input.tournamentId,
        name: input.name,
        slug,
        logo_url: input.logoUrl || null,
        primary_color: input.primaryColor || null,
        coach_name: input.coachName || null,
        home_venue: input.homeVenue || null,
      })
      .select('*')
      .single(),
    'Creacion de equipo'
  )

  if (error) throw new Error(`No se pudo crear el equipo: ${error.message}`)

  return mapTeam(data as TeamRow)
}

async function createTeamSlug(tournamentId: string, name: string) {
  const supabase = getAdminClient()
  const baseSlug = slugifyMiTorneito(name, 'equipo')
  const { data, error } = await withMiTorneitoQueryTimeout(
    supabase
      .from('mi_torneito_teams')
      .select('slug')
      .eq('tournament_id', tournamentId)
      .like('slug', `${baseSlug}%`),
    'Consulta de slug de equipo'
  )

  if (error) throw error

  const used = new Set(((data ?? []) as Array<{ slug: string }>).map((row) => row.slug))
  if (!used.has(baseSlug)) return baseSlug

  let index = 2
  while (used.has(`${baseSlug}-${index}`)) index += 1

  return `${baseSlug}-${index}`
}

export async function createMiTorneitoRound(input: MiTorneitoRoundInput) {
  const supabase = getAdminClient()
  const slug = await createRoundSlug(input.tournamentId, input.name)
  const { data, error } = await withMiTorneitoQueryTimeout(
    supabase
      .from('mi_torneito_rounds')
      .insert({
        tournament_id: input.tournamentId,
        name: input.name,
        slug,
        phase: input.phase,
        sort_order: input.sortOrder,
      })
      .select('*')
      .single(),
    'Creacion de ronda'
  )

  if (error) throw new Error(`No se pudo crear la ronda: ${error.message}`)

  return mapRound(data as RoundRow)
}

async function createRoundSlug(tournamentId: string, name: string) {
  const supabase = getAdminClient()
  const baseSlug = slugifyMiTorneito(name, 'ronda')
  const { data, error } = await withMiTorneitoQueryTimeout(
    supabase
      .from('mi_torneito_rounds')
      .select('slug')
      .eq('tournament_id', tournamentId)
      .like('slug', `${baseSlug}%`),
    'Consulta de slug de ronda'
  )

  if (error) throw error

  const used = new Set(((data ?? []) as Array<{ slug: string }>).map((row) => row.slug))
  if (!used.has(baseSlug)) return baseSlug

  let index = 2
  while (used.has(`${baseSlug}-${index}`)) index += 1

  return `${baseSlug}-${index}`
}

export async function createMiTorneitoMatch(input: MiTorneitoMatchInput) {
  const supabase = getAdminClient()
  const { data, error } = await withMiTorneitoQueryTimeout(
    supabase
      .from('mi_torneito_matches')
      .insert({
        tournament_id: input.tournamentId,
        round_id: input.roundId || null,
        home_team_id: input.homeTeamId || null,
        away_team_id: input.awayTeamId || null,
        scheduled_at: input.scheduledAt || null,
        venue: input.venue || null,
        status: input.status,
        broadcast_label: input.broadcastLabel || null,
        notes: input.notes || null,
      })
      .select('*')
      .single(),
    'Creacion de partido'
  )

  if (error) throw new Error(`No se pudo crear el partido: ${error.message}`)

  return mapMatch(data as MatchRow)
}

export async function updateMiTorneitoMatchResult(input: MiTorneitoMatchResultInput) {
  const supabase = getAdminClient()
  const { error } = await withMiTorneitoQueryTimeout(
    supabase
      .from('mi_torneito_matches')
      .update({
        status: input.status,
        home_score: input.homeScore ?? null,
        away_score: input.awayScore ?? null,
        home_penalty_score: input.homePenaltyScore ?? null,
        away_penalty_score: input.awayPenaltyScore ?? null,
        minute: input.minute ?? null,
      })
      .eq('id', input.matchId),
    'Actualizacion de resultado'
  )

  if (error) throw new Error(`No se pudo actualizar el resultado: ${error.message}`)
}

export async function assignMiTorneitoTournamentAdmin(input: {
  tournamentId: string
  email: string
  role: MiTorneitoAdminRole
  userId?: string | null
  actorUserId?: string | null
}) {
  const supabase = getAdminClient()
  const email = normalizeEmail(input.email)
  const { error } = await withMiTorneitoQueryTimeout(
    supabase
      .from('mi_torneito_tournament_admins')
      .upsert(
        {
          tournament_id: input.tournamentId,
          email,
          user_id: input.userId || null,
          role: input.role,
          active: true,
          created_by: input.actorUserId || null,
        },
        {
          onConflict: 'tournament_id,email',
        }
      ),
    'Asignacion de administrador'
  )

  if (error) throw new Error(`No se pudo asignar el administrador: ${error.message}`)
}

export async function isMiTorneitoAdminForTournament(input: {
  tournamentId: string
  email: string
  userId?: string | null
}) {
  const supabase = getAdminClient()
  const normalizedEmail = normalizeEmail(input.email)
  const query = supabase
    .from('mi_torneito_tournament_admins')
    .select('id')
    .eq('tournament_id', input.tournamentId)
    .eq('active', true)
    .limit(1)

  const { data, error } = input.userId
    ? await withMiTorneitoQueryTimeout(
        query.or(`email.ilike.${normalizedEmail},user_id.eq.${input.userId}`),
        'Validacion de permisos'
      )
    : await withMiTorneitoQueryTimeout(
        query.ilike('email', normalizedEmail),
        'Validacion de permisos'
      )

  if (error) throw new Error(`No se pudo validar el permiso del torneo: ${error.message}`)

  return Boolean(data?.length)
}

export async function writeMiTorneitoAuditLog(input: {
  tournamentId?: string | null
  actorUserId?: string | null
  actorEmail?: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown>
}) {
  try {
    const supabase = getAdminClient()
    await withMiTorneitoQueryTimeout(
      supabase
        .from('mi_torneito_audit_logs')
        .insert({
          tournament_id: input.tournamentId || null,
          actor_user_id: input.actorUserId || null,
          actor_email: input.actorEmail || null,
          action: input.action,
          entity_type: input.entityType,
          entity_id: input.entityId || null,
          metadata: input.metadata || {},
        }),
      'Audit log'
    )
  } catch (error) {
    console.warn('[mi-torneito] No se pudo escribir audit log.', error)
  }
}

export function getMiTorneitoErrorMessage(error: unknown, fallback = 'No se pudo completar la accion.') {
  if (typeof error === 'object' && error !== null) {
    const adminError = error as AdminDataError
    if (adminError.message) return adminError.message
  }

  return error instanceof Error ? error.message : fallback
}
