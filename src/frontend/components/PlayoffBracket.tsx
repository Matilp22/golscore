import type { ReactNode } from 'react'
import { TeamLogo } from '@/frontend/components/AssetImage'
import type { LeagueStandingRow } from '@/lib/api-football'

type ZoneName = 'Zona A' | 'Zona B'

export type PlayoffTeam = {
  seed: number
  zone: ZoneName
  teamId?: number
  name: string
  logo?: string
  points: number
  goalDifference: number
  goalsFor: number
}

export type PlayoffMatch = {
  id: string
  participants: [PlayoffTeam, PlayoffTeam]
  scores?: [number | null, number | null]
}

export type PlayoffSide = {
  roundOf16: PlayoffMatch[]
  quarterFinals: string[]
  semiFinal: string
}

export type PlayoffBracketData = {
  available: boolean
  message?: string
  left: PlayoffSide
  right: PlayoffSide
}

type PlayoffBracketProps = {
  zoneAStandings?: LeagueStandingRow[] | null
  zoneBStandings?: LeagueStandingRow[] | null
}

type SeedRef = {
  zone: 'A' | 'B'
  seed: number
}

type SeedMatchRef = {
  home: SeedRef
  away: SeedRef
}

const PHASE_TITLES = [
  'Octavos de final',
  'Cuartos de final',
  'Semifinal',
  'Final',
  'Semifinal',
  'Cuartos de final',
  'Octavos de final',
]

const LEFT_ROUND_OF_16: SeedMatchRef[] = [
  { home: { zone: 'A', seed: 1 }, away: { zone: 'B', seed: 8 } },
  { home: { zone: 'B', seed: 4 }, away: { zone: 'A', seed: 5 } },
  { home: { zone: 'B', seed: 2 }, away: { zone: 'A', seed: 7 } },
  { home: { zone: 'A', seed: 3 }, away: { zone: 'B', seed: 6 } },
]

const RIGHT_ROUND_OF_16: SeedMatchRef[] = [
  { home: { zone: 'B', seed: 1 }, away: { zone: 'A', seed: 8 } },
  { home: { zone: 'A', seed: 4 }, away: { zone: 'B', seed: 5 } },
  { home: { zone: 'A', seed: 2 }, away: { zone: 'B', seed: 7 } },
  { home: { zone: 'B', seed: 3 }, away: { zone: 'A', seed: 6 } },
]

function sortZoneStandings(rows: LeagueStandingRow[]) {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    return a.teamName.localeCompare(b.teamName)
  })
}

function toPlayoffTeam(row: LeagueStandingRow, seed: number, zone: ZoneName): PlayoffTeam {
  return {
    seed,
    zone,
    teamId: row.teamId,
    name: row.teamName,
    logo: row.teamLogo,
    points: row.points,
    goalDifference: row.goalDifference,
    goalsFor: row.goalsFor,
  }
}

function buildZoneSeeds(rows: LeagueStandingRow[], zone: ZoneName) {
  return sortZoneStandings(rows).map((row, index) =>
    toPlayoffTeam(row, index + 1, zone)
  )
}

function createPlayoffMatch(id: string, first: PlayoffTeam, second: PlayoffTeam): PlayoffMatch {
  return {
    id,
    participants: [first, second],
  }
}

function getTeamBySeed(zoneA: PlayoffTeam[], zoneB: PlayoffTeam[], seedRef: SeedRef) {
  return (seedRef.zone === 'A' ? zoneA : zoneB)[seedRef.seed - 1]
}

function createSeedMatch(
  id: string,
  zoneA: PlayoffTeam[],
  zoneB: PlayoffTeam[],
  matchRef: SeedMatchRef
) {
  return createPlayoffMatch(
    id,
    getTeamBySeed(zoneA, zoneB, matchRef.home),
    getTeamBySeed(zoneA, zoneB, matchRef.away)
  )
}

function emptySide(): PlayoffSide {
  return {
    roundOf16: [],
    quarterFinals: ['A confirmar', 'A confirmar'],
    semiFinal: 'A confirmar',
  }
}

export function generatePlayoffBracket(
  zoneAStandings: LeagueStandingRow[] = [],
  zoneBStandings: LeagueStandingRow[] = []
): PlayoffBracketData {
  const zoneA = buildZoneSeeds(zoneAStandings, 'Zona A')
  const zoneB = buildZoneSeeds(zoneBStandings, 'Zona B')

  if (zoneA.length < 8 || zoneB.length < 8) {
    return {
      available: false,
      message: 'Las llaves estarán disponibles cuando haya al menos 8 equipos por zona',
      left: emptySide(),
      right: emptySide(),
    }
  }

  return {
    available: true,
    left: {
      roundOf16: LEFT_ROUND_OF_16.map((matchRef, index) =>
        createSeedMatch(`left-${index + 1}`, zoneA, zoneB, matchRef)
      ),
      quarterFinals: ['A confirmar', 'A confirmar'],
      semiFinal: 'A confirmar',
    },
    right: {
      roundOf16: RIGHT_ROUND_OF_16.map((matchRef, index) =>
        createSeedMatch(`right-${index + 1}`, zoneA, zoneB, matchRef)
      ),
      quarterFinals: ['A confirmar', 'A confirmar'],
      semiFinal: 'A confirmar',
    },
  }
}

function SkeletonBracket() {
  return (
    <section className="w-full overflow-hidden rounded-3xl border border-white/8 bg-[#0f1317]/92">
      <div className="border-b border-white/6 bg-[#13181d] px-3 py-4 md:px-5">
        <div className="h-5 w-56 animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-3 w-80 max-w-full animate-pulse rounded bg-white/8" />
      </div>
      <div className="grid gap-3 p-3 md:grid-cols-4 md:p-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl border border-white/7 bg-white/[0.035]"
          />
        ))}
      </div>
    </section>
  )
}

function TeamSlot({ team, score }: { team: PlayoffTeam; score?: number | null }) {
  return (
    <div className="grid min-w-0 grid-cols-[18px_minmax(0,1fr)_22px] items-center gap-1.5 rounded-lg border border-white/7 bg-[#111820]/88 px-2 py-1.5">
      <TeamLogo
        src={team.logo}
        alt={team.name}
        size={18}
        className="h-[18px] w-[18px] object-contain"
        fallbackClassName="h-[18px] w-[15px]"
      />
      <div className="min-w-0">
        <p className="truncate text-[12px] font-bold text-white">{team.name}</p>
        <p className="truncate text-[9px] font-semibold uppercase tracking-[0.06em] text-[#8d98a7]">
          {team.zone}
        </p>
      </div>
      <span className="flex h-6 w-[22px] items-center justify-center rounded-md border border-white/8 bg-[#0d1217] text-[11px] font-black text-[#c7d0da]">
        {score ?? '-'}
      </span>
    </div>
  )
}

function MatchCard({ match }: { match: PlayoffMatch }) {
  return (
    <div className="min-h-[84px] rounded-xl border border-[#25553d]/35 bg-[linear-gradient(180deg,rgba(19,32,25,0.9),rgba(15,19,23,0.92))] p-1.5 shadow-[inset_0_1px_0_rgba(127,240,178,0.08)]">
      <div className="space-y-1.5">
        <TeamSlot team={match.participants[0]} score={match.scores?.[0]} />
        <TeamSlot team={match.participants[1]} score={match.scores?.[1]} />
      </div>
    </div>
  )
}

function PendingTeamSlot() {
  return (
    <div className="grid min-w-0 grid-cols-[18px_minmax(0,1fr)_22px] items-center gap-1.5 rounded-lg border border-white/7 bg-[#111820]/88 px-2 py-1.5">
      <span className="h-[18px] w-[15px] bg-[#6f7884] [clip-path:polygon(50%_0,92%_16%,84%_72%,50%_100%,16%_72%,8%_16%)]" />
      <div className="min-w-0">
        <p className="truncate text-[12px] font-bold text-white">A confirmar</p>
        <p className="truncate text-[9px] font-semibold uppercase tracking-[0.06em] text-[#8d98a7]">
          Pendiente
        </p>
      </div>
      <span className="flex h-6 w-[22px] items-center justify-center rounded-md border border-white/8 bg-[#0d1217] text-[11px] font-black text-[#c7d0da]">
        -
      </span>
    </div>
  )
}

function PendingMatchCard({ final = false }: { final?: boolean }) {
  return (
    <div
      className={`min-h-[84px] rounded-xl border bg-[linear-gradient(180deg,rgba(19,32,25,0.9),rgba(15,19,23,0.92))] p-1.5 shadow-[inset_0_1px_0_rgba(127,240,178,0.08)] ${
        final
          ? 'w-[160px] border-[#7ff0b2]/75 shadow-[0_0_26px_rgba(127,240,178,0.18),inset_0_1px_0_rgba(127,240,178,0.1)]'
          : 'border-[#25553d]/35'
      }`}
    >
      {final ? (
        <div className="mb-1 text-center text-[9px] font-black uppercase tracking-[0.12em] text-[#7ff0b2]">
          Final
        </div>
      ) : null}
      <div className="space-y-1.5">
        <PendingTeamSlot />
        <PendingTeamSlot />
      </div>
    </div>
  )
}

function QuarterColumn({ labels }: { labels: string[] }) {
  return (
    <div className="flex h-full flex-col">
      {labels.map((label, index) => (
        <div
          key={`${label}-${index}`}
          className="flex h-1/2 items-center justify-center"
        >
          <PendingMatchCard />
        </div>
      ))}
    </div>
  )
}

function CenteredColumn({ children, withConnector = false }: { children: ReactNode; withConnector?: boolean }) {
  return (
    <div className={`flex h-full items-center justify-center ${withConnector ? 'relative' : ''}`}>
      {children}
    </div>
  )
}

export default function PlayoffBracket({
  zoneAStandings,
  zoneBStandings,
}: PlayoffBracketProps) {
  if (!zoneAStandings || !zoneBStandings) return <SkeletonBracket />

  const bracket = generatePlayoffBracket(zoneAStandings, zoneBStandings)

  return (
    <section className="w-full overflow-hidden rounded-3xl border border-white/8 bg-[#0f1317]/92">
      <div className="border-b border-white/6 bg-[#13181d] px-3 py-4 md:px-5">
        <h2 className="text-base font-bold text-white md:text-lg">
          Llaves - Torneo Clausura
        </h2>
        <p className="mt-1 text-sm text-[#8d98a7]">
          Cruces generados automáticamente según la tabla actual
        </p>
      </div>

      <div className="p-3 md:p-4">
        {!bracket.available ? (
          <div className="rounded-2xl border border-[#25553d]/35 bg-[#101820] px-4 py-5 text-sm font-medium text-[#c7d0da]">
            {bracket.message}
          </div>
        ) : (
          <div className="overflow-x-auto pb-3 lg:overflow-x-visible">
            <div className="min-w-[840px] rounded-2xl border border-white/8 bg-[linear-gradient(180deg,#11161b_0%,#0d1217_100%)] p-2.5 shadow-[inset_0_0_0_1px_rgba(127,240,178,0.05)] lg:min-w-0">
              <div className="grid grid-cols-7 gap-2">
                {PHASE_TITLES.map((title, index) => (
                  <h3
                    key={`${title}-${index}`}
                    className="min-h-7 text-center text-[10px] font-black uppercase leading-tight tracking-[0.08em] text-[#7ff0b2]"
                  >
                    {title}
                  </h3>
                ))}
              </div>

              <div className="grid min-h-[540px] grid-cols-7 gap-2">
                <div className="flex h-full flex-col justify-center gap-4">
                  {bracket.left.roundOf16.map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>

                <QuarterColumn labels={bracket.left.quarterFinals} />

                <CenteredColumn>
                  <PendingMatchCard />
                </CenteredColumn>

                <CenteredColumn>
                  <PendingMatchCard final />
                </CenteredColumn>

                <CenteredColumn>
                  <PendingMatchCard />
                </CenteredColumn>

                <QuarterColumn labels={bracket.right.quarterFinals} />

                <div className="flex h-full flex-col justify-center gap-4">
                  {bracket.right.roundOf16.map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
