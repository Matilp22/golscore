import Link from 'next/link'
import SafeImage from '@/frontend/components/SafeImage'
import { TeamLogo } from '@/frontend/components/AssetImage'
import type { MatchBroadcaster, MatchGoalScorer, MatchGoalScorers } from '@/lib/api-football'
import { formatEventMinute } from '@/shared/utils/event-minute'

type MatchRowProps = {
  id?: number | string
  league: string
  country?: string
  time?: string
  home: string
  away: string
  homeLogo?: string
  awayLogo?: string
  score: string
  status: string
  goalScorers?: MatchGoalScorers
  broadcasters?: MatchBroadcaster[]
  broadcastChannel?: string | null
  broadcastLogoUrl?: string | null
}

function formatCenterStatus(status: string, centerLabel: string) {
  if (!status || status === centerLabel) return ''

  const normalizedStatus = status.toLowerCase()

  if (normalizedStatus === 'finalizado') return 'FINAL'
  if (normalizedStatus === 'entretiempo') return 'ENTRETIEMPO'

  return status
}

function getCenterStatusClass(status: string) {
  const normalizedStatus = status.toLowerCase()

  if (normalizedStatus.includes('en vivo')) return 'text-[#7ff0b2]'
  if (normalizedStatus === 'entretiempo') return 'text-[#f3d36c]'
  if (normalizedStatus === 'finalizado' || normalizedStatus === 'final') return 'text-[#b8bec8]'

  return 'text-[#a8b0bc]'
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
      <SafeImage
        src={logoUrl}
        alt={label}
        imageType="broadcast"
        width={16}
        height={16}
        className="h-4 w-4 shrink-0 object-contain"
        fallbackClassName="h-3 w-3 shrink-0"
      />
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
      <TeamLogo
        src={logo}
        alt={name}
        size={20}
        className="h-5 w-5 object-contain"
        fallbackClassName="h-4 w-3"
      />
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
  home,
  away,
  homeLogo,
  awayLogo,
  score,
  status,
  goalScorers,
  broadcasters,
  broadcastChannel,
  broadcastLogoUrl,
}: MatchRowProps) {
  const normalizedStatus = status.toLowerCase()
  const isLive = normalizedStatus.includes('en vivo') || normalizedStatus === 'entretiempo'
  const isTimeStatus = /^\d{1,2}:\d{2}$/.test(status.trim())
  const isScheduled = score === '- - -' && !isLive && isTimeStatus
  const centerLabel = isScheduled
    ? time || 'vs'
    : score === '- - -'
      ? 'vs'
      : score
  const centerStatus = isTimeStatus ? '' : formatCenterStatus(status, String(centerLabel))
  const allBroadcasters =
    broadcasters?.length
      ? broadcasters
      : broadcastChannel
        ? [{ name: broadcastChannel, logoUrl: broadcastLogoUrl, country: null }]
        : []
  const broadcastText = allBroadcasters.map((broadcaster) => broadcaster.name).join(' / ')

  return (
    <Link
      href={`/partido/${id}`}
      className="block border-b border-white/6 bg-[#0b1210]/75 px-2.5 py-1.5 transition hover:bg-[rgba(112,255,157,0.055)] sm:px-3"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_62px_minmax(0,1fr)] items-center gap-1.5 md:grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] md:gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <BroadcastBadge broadcasters={allBroadcasters} className="hidden w-[104px] shrink-0 md:flex" />
          <TeamBadge logo={homeLogo} name={home} />
        </div>

        <div className="text-center">
          <div className={`rounded-lg border border-white/8 bg-black/25 px-1.5 py-0.5 text-[11px] font-black leading-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:text-xs ${isLive ? 'border-[#70ff9d]/35 text-[#70ff9d] shadow-[0_0_20px_rgba(112,255,157,0.12)]' : ''}`}>
            {centerLabel}
          </div>
          {centerStatus ? (
            <div className={`mt-0.5 truncate text-[9px] font-black uppercase leading-none ${getCenterStatusClass(status)}`}>
              {centerStatus}
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
    </Link>
  )
}
