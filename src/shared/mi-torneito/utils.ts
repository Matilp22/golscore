import type {
  MiTorneitoMatch,
  MiTorneitoMatchStatus,
  MiTorneitoTeam,
  MiTorneitoTournament,
} from '@/shared/mi-torneito/types'

export function normalizeMiTorneitoText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function slugifyMiTorneito(value: string, fallback = 'torneo') {
  const slug = normalizeMiTorneitoText(value)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || fallback
}

export function formatMiTorneitoDate(value: string | null | undefined) {
  if (!value) return 'Fecha a confirmar'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date)
}

export function formatMiTorneitoDateTime(value: string | null | undefined) {
  if (!value) return 'Horario a confirmar'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date)
}

export function formatMiTorneitoTime(value: string | null | undefined) {
  if (!value) return 'A confirmar'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date)
}

export function getMiTorneitoTeamById(teams: MiTorneitoTeam[], teamId: string | null) {
  if (!teamId) return null

  return teams.find((team) => team.id === teamId) ?? null
}

export function getMiTorneitoMatchLabel(match: MiTorneitoMatch, teams: MiTorneitoTeam[]) {
  const home = getMiTorneitoTeamById(teams, match.homeTeamId)?.name ?? 'Local'
  const away = getMiTorneitoTeamById(teams, match.awayTeamId)?.name ?? 'Visitante'

  return `${home} vs ${away}`
}

export function getMiTorneitoScore(match: MiTorneitoMatch) {
  if (match.homeScore === null || match.awayScore === null) return 'vs'

  const penalties =
    match.homePenaltyScore !== null && match.awayPenaltyScore !== null
      ? ` (${match.homePenaltyScore}-${match.awayPenaltyScore})`
      : ''

  return `${match.homeScore} - ${match.awayScore}${penalties}`
}

export function isMiTorneitoMatchFinished(status: MiTorneitoMatchStatus) {
  return status === 'finished'
}

export function isMiTorneitoTournamentPublic(tournament: MiTorneitoTournament) {
  return tournament.visibility === 'public' || tournament.visibility === 'unlisted'
}
