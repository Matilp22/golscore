import 'server-only'

import type {
  MiTorneitoMatch,
  MiTorneitoStandingRow,
  MiTorneitoTeam,
  MiTorneitoTournament,
} from '@/shared/mi-torneito/types'
import { isMiTorneitoMatchFinished } from '@/shared/mi-torneito/utils'

type MutableStanding = Omit<MiTorneitoStandingRow, 'position'>

function createStanding(team: MiTorneitoTeam): MutableStanding {
  return {
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }
}

function applyResult(
  row: MutableStanding,
  goalsFor: number,
  goalsAgainst: number,
  points: number
) {
  row.played += 1
  row.goalsFor += goalsFor
  row.goalsAgainst += goalsAgainst
  row.goalDifference = row.goalsFor - row.goalsAgainst
  row.points += points

  if (goalsFor > goalsAgainst) row.won += 1
  else if (goalsFor < goalsAgainst) row.lost += 1
  else row.drawn += 1
}

export function computeMiTorneitoStandings({
  tournament,
  teams,
  matches,
}: {
  tournament: MiTorneitoTournament
  teams: MiTorneitoTeam[]
  matches: MiTorneitoMatch[]
}): MiTorneitoStandingRow[] {
  const rows = new Map(teams.map((team) => [team.id, createStanding(team)]))

  for (const match of matches) {
    if (!isMiTorneitoMatchFinished(match.status)) continue
    if (!match.homeTeamId || !match.awayTeamId) continue
    if (match.homeScore === null || match.awayScore === null) continue

    const home = rows.get(match.homeTeamId)
    const away = rows.get(match.awayTeamId)
    if (!home || !away) continue

    if (match.homeScore > match.awayScore) {
      applyResult(home, match.homeScore, match.awayScore, tournament.pointsWin)
      applyResult(away, match.awayScore, match.homeScore, tournament.pointsLoss)
    } else if (match.homeScore < match.awayScore) {
      applyResult(home, match.homeScore, match.awayScore, tournament.pointsLoss)
      applyResult(away, match.awayScore, match.homeScore, tournament.pointsWin)
    } else {
      applyResult(home, match.homeScore, match.awayScore, tournament.pointsDraw)
      applyResult(away, match.awayScore, match.homeScore, tournament.pointsDraw)
    }
  }

  return Array.from(rows.values())
    .sort((a, b) => (
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.team.name.localeCompare(b.team.name, 'es')
    ))
    .map((row, index) => ({
      ...row,
      position: index + 1,
    }))
}
