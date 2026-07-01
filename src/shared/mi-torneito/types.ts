export type MiTorneitoRequestStatus =
  | 'pending'
  | 'contacted'
  | 'approved'
  | 'rejected'
  | 'archived'

export type MiTorneitoTournamentStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'finished'
  | 'archived'

export type MiTorneitoVisibility = 'public' | 'unlisted' | 'private'

export type MiTorneitoRoundPhase = 'group' | 'knockout' | 'final'

export type MiTorneitoMatchStatus =
  | 'scheduled'
  | 'live'
  | 'finished'
  | 'postponed'
  | 'cancelled'

export type MiTorneitoAdminRole = 'owner' | 'editor'

export type MiTorneitoOrganization = {
  id: string
  name: string
  slug: string
  city: string | null
  contactEmail: string | null
  contactPhone: string | null
  active: boolean
}

export type MiTorneitoTournamentRequest = {
  id: string
  organizerName: string
  organizerEmail: string
  organizerPhone: string | null
  tournamentName: string
  city: string | null
  expectedTeams: number | null
  notes: string | null
  status: MiTorneitoRequestStatus
  adminNotes: string | null
  reviewedAt: string | null
  createdAt: string
}

export type MiTorneitoTournament = {
  id: string
  organizationId: string | null
  name: string
  slug: string
  shortDescription: string | null
  city: string | null
  venue: string | null
  season: string | null
  format: string | null
  status: MiTorneitoTournamentStatus
  visibility: MiTorneitoVisibility
  startsOn: string | null
  endsOn: string | null
  logoUrl: string | null
  coverUrl: string | null
  pointsWin: number
  pointsDraw: number
  pointsLoss: number
  createdAt: string
  updatedAt: string
}

export type MiTorneitoTeam = {
  id: string
  tournamentId: string
  name: string
  slug: string
  logoUrl: string | null
  primaryColor: string | null
  coachName: string | null
  homeVenue: string | null
  active: boolean
  createdAt: string
}

export type MiTorneitoRound = {
  id: string
  tournamentId: string
  name: string
  slug: string
  phase: MiTorneitoRoundPhase
  sortOrder: number
}

export type MiTorneitoMatch = {
  id: string
  tournamentId: string
  roundId: string | null
  homeTeamId: string | null
  awayTeamId: string | null
  scheduledAt: string | null
  venue: string | null
  status: MiTorneitoMatchStatus
  homeScore: number | null
  awayScore: number | null
  homePenaltyScore: number | null
  awayPenaltyScore: number | null
  minute: number | null
  broadcastLabel: string | null
  notes: string | null
  createdAt: string
}

export type MiTorneitoTournamentAdmin = {
  id: string
  tournamentId: string
  userId: string | null
  email: string
  role: MiTorneitoAdminRole
  active: boolean
  invitedAt: string
}

export type MiTorneitoStandingRow = {
  position: number
  team: MiTorneitoTeam
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

export type MiTorneitoTournamentBundle = {
  organization: MiTorneitoOrganization | null
  tournament: MiTorneitoTournament
  teams: MiTorneitoTeam[]
  rounds: MiTorneitoRound[]
  matches: MiTorneitoMatch[]
  standings: MiTorneitoStandingRow[]
  admins?: MiTorneitoTournamentAdmin[]
}

export type MiTorneitoDataError = {
  message: string
  setupRequired?: boolean
}

export type MiTorneitoDataResult<T> =
  | {
      data: T
      error: null
    }
  | {
      data: T
      error: MiTorneitoDataError
    }

export const MI_TORNEITO_STATUS_LABELS: Record<MiTorneitoTournamentStatus, string> = {
  draft: 'Borrador',
  scheduled: 'Programado',
  active: 'En juego',
  finished: 'Finalizado',
  archived: 'Archivado',
}

export const MI_TORNEITO_MATCH_STATUS_LABELS: Record<MiTorneitoMatchStatus, string> = {
  scheduled: 'Programado',
  live: 'En vivo',
  finished: 'Finalizado',
  postponed: 'Postergado',
  cancelled: 'Cancelado',
}

export const MI_TORNEITO_REQUEST_STATUS_LABELS: Record<MiTorneitoRequestStatus, string> = {
  pending: 'Pendiente',
  contacted: 'Contactado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  archived: 'Archivado',
}
