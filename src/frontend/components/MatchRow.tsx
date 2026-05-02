import Image from 'next/image'
import Link from 'next/link'
import type { MatchBroadcaster, MatchGoalScorer, MatchGoalScorers } from '@/lib/api-football'
import { formatEventMinute } from '@/shared/utils/event-minute'

type MatchRowProps = {
  id?: number | string
  league: string
  country?: string
  time?: string
  minute?: string | number | null
  home: string
  away: string
  homeLogo?: string
  awayLogo?: string
  score: string
  status: string
  statusUnderScore?: string
  goalScorers?: MatchGoalScorers
  broadcasters?: MatchBroadcaster[]
  broadcastChannel?: string | null
  broadcastLogoUrl?: string | null
}

function StatusBadge({ status }: { status: string }) {
  const isLive = status.includes('EN VIVO') || status.includes("'")
  const isFinal = status === 'FINAL'
  const isHalf = status === 'ENTRETIEMPO'

  const classes = isLive
    ? 'bg-[#163828] text-[#7ff0b2] border-[#25553d]'
    : isFinal
    ? 'bg-[#1c1f24] text-[#b8bec8] border-[#2a3038]'
    : isHalf
    ? 'bg-[#3f3616] text-[#f3d36c] border-[#574b20]'
    : 'bg-[#1c2128] text-[#a8b0bc] border-[#2a3038]'

  return (
    <span className={`max-w-full whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${classes}`}>
      {status}
    </span>
  )
}

function BroadcastBadge({
  broadcasters,
  className = '',
}: {
  broadcasters: MatchBroadcaster[]
  className?: string
}) {
  if (!broadcasters.length) return null

  const label = broadcasters.map((broadcaster) => broadcaster.name).join(' / ')
  const logoUrl = broadcasters.find((broadcaster) => broadcaster.logoUrl)?.logoUrl ?? null

  return (
    <div className={`flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-[#aab6c4] ${className}`}>
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={label}
          width={16}
          height={16}
          className="h-4 w-4 shrink-0 object-contain"
        />
      ) : (
        <span className="h-2 w-2 shrink-0 rounded-sm bg-[#7ff0b2]/80" aria-hidden="true" />
      )}
      <span className="min-w-0 truncate">{label}</span>
    </div>
  )
}

function TeamBadge({
  logo,
  name,
  align = 'left',
}: {
  logo?: string
  name: string
  align?: 'left' | 'right'
}) {
  const logoNode = (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden">
      {logo ? (
        <Image src={logo} alt={name} width={20} height={20} className="h-5 w-5 object-contain" />
      ) : (
        <span className="h-3.5 w-2.5 bg-[#6f7884] [clip-path:polygon(50%_0,92%_16%,84%_72%,50%_100%,16%_72%,8%_16%)]" />
      )}
    </div>
  )

  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${align === 'right' ? 'justify-end text-right' : ''}`}>
      {align === 'right' ? null : logoNode}
      <span className="min-w-0 truncate text-[11px] font-semibold text-[#f2f4f7] sm:text-[12px]">{name}</span>
      {align === 'right' ? logoNode : null}
    </div>
  )
}

function formatGoalScorer(goal: MatchGoalScorer) {
  const suffix =
    goal.kind === 'penalty'
      ? ' (P)'
      : goal.kind === 'own-goal'
        ? ' (e/c)'
        : ''

  return `${formatEventMinute(goal.minute, goal.extraMinute)} ${goal.player}${suffix}`
}

function GoalScorersLine({ goalScorers }: { goalScorers?: MatchGoalScorers }) {
  const homeGoals = goalScorers?.home.map(formatGoalScorer).join('; ') || ''
  const awayGoals = goalScorers?.away.map(formatGoalScorer).join('; ') || ''
  const unassignedGoals = goalScorers?.unassigned?.map(formatGoalScorer).join('; ') || ''

  if (!homeGoals && !awayGoals && !unassignedGoals) return null

  const clampStyle = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  } as const

  if (unassignedGoals && !homeGoals && !awayGoals) {
    return (
      <div className="mt-1 min-w-0 overflow-hidden break-words text-[10px] leading-tight text-[#8d98a7]" style={clampStyle}>
        Goles: {unassignedGoals}
      </div>
    )
  }

  return (
    <div className="mt-1 space-y-0.5 text-[10px] leading-tight text-[#8d98a7]">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_62px_minmax(0,1fr)] gap-1.5 md:grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] md:gap-2">
        <div className="min-w-0 overflow-hidden break-words" style={clampStyle}>
          {homeGoals}
        </div>
        <div aria-hidden="true" />
        <div className="min-w-0 overflow-hidden break-words text-right" style={clampStyle}>
          {awayGoals}
        </div>
      </div>
      {unassignedGoals ? (
        <div className="min-w-0 overflow-hidden break-words" style={clampStyle}>
          Goles: {unassignedGoals}
        </div>
      ) : null}
    </div>
  )
}

export default function MatchRow({
  id = 1,
  time,
  minute,
  home,
  away,
  homeLogo,
  awayLogo,
  score,
  status,
  statusUnderScore,
  goalScorers,
  broadcasters,
  broadcastChannel,
  broadcastLogoUrl,
}: MatchRowProps) {
  const isLive = status.includes('EN VIVO')
  const centerLabel = score === '- - -' ? minute || time || 'vs' : score
  const allBroadcasters =
    broadcasters?.length
      ? broadcasters
      : broadcastChannel
        ? [{ name: broadcastChannel, logoUrl: broadcastLogoUrl, country: null }]
        : []
  const broadcastText = allBroadcasters.map((broadcaster) => broadcaster.name).join(' / ')
  const isScheduled = score === '- - -'
  const statusCandidate = statusUnderScore || (!isScheduled ? minute || status : '')
  const subScore =
    statusCandidate && String(statusCandidate) !== String(centerLabel)
      ? statusCandidate
      : ''

  return (
    <Link
      href={`/partido/${id}`}
      className="block border-b border-white/6 bg-[#111418] px-2.5 py-1.5 transition hover:bg-[#161a20] sm:px-3"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_62px_minmax(0,1fr)] items-center gap-1.5 md:grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] md:gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <BroadcastBadge broadcasters={allBroadcasters} className="hidden w-[104px] shrink-0 md:flex" />
          <TeamBadge logo={homeLogo} name={home} />
        </div>

        <div className="text-center">
          <div className={`rounded-md border border-white/8 bg-[#0f1317] px-1.5 py-0.5 text-[11px] font-black leading-tight text-white sm:text-xs ${isLive ? 'text-[#7ff0b2]' : ''}`}>
            {centerLabel}
          </div>
          {subScore ? (
            <div className="mt-0.5 truncate text-[9px] font-semibold uppercase leading-none text-[#8d98a7]">
              {subScore}
            </div>
          ) : null}
        </div>

        <TeamBadge logo={awayLogo} name={away} align="right" />
      </div>

      {broadcastText ? (
        <div className="mt-1 min-w-0 truncate text-center text-[10px] font-semibold leading-tight text-[#aab6c4] md:hidden">
          TV: {broadcastText}
        </div>
      ) : null}

      <GoalScorersLine goalScorers={goalScorers} />

      <div className="mt-1 flex min-w-0 justify-end md:hidden">
        <StatusBadge status={status} />
      </div>
    </Link>
  )
}
