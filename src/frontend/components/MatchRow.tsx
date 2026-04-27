import Image from 'next/image'
import Link from 'next/link'
import type { MatchGoalScorer, MatchGoalScorers } from '@/lib/api-football'

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
  goalScorers?: MatchGoalScorers
  broadcastChannel?: string | null
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
    <span className={`max-w-full whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${classes}`}>
      {status}
    </span>
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
    <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden">
      {logo ? (
        <Image src={logo} alt={name} width={24} height={24} className="h-6 w-6 object-contain" />
      ) : (
        <span className="h-4 w-3 bg-[#6f7884] [clip-path:polygon(50%_0,92%_16%,84%_72%,50%_100%,16%_72%,8%_16%)]" />
      )}
    </div>
  )

  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'justify-end text-right' : ''}`}>
      {align === 'right' ? null : logoNode}
      <span className="min-w-0 truncate text-[12px] font-semibold text-[#f2f4f7] sm:text-sm">{name}</span>
      {align === 'right' ? logoNode : null}
    </div>
  )
}

function formatGoalScorer(goal: MatchGoalScorer) {
  const minute =
    goal.extraMinute && goal.extraMinute > 0
      ? `${goal.minute}+${goal.extraMinute}'`
      : `${goal.minute}'`
  const suffix =
    goal.kind === 'penalty'
      ? ' (P)'
      : goal.kind === 'own-goal'
        ? ' (e/c)'
        : ''

  return `${minute} ${goal.player}${suffix}`
}

function GoalScorersLine({ goalScorers }: { goalScorers?: MatchGoalScorers }) {
  const homeGoals = goalScorers?.home.map(formatGoalScorer).join('; ') || ''
  const awayGoals = goalScorers?.away.map(formatGoalScorer).join('; ') || ''

  if (!homeGoals && !awayGoals) return null

  const clampStyle = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  } as const

  return (
    <div className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] gap-2 text-[11px] leading-snug text-[#8d98a7] md:grid-cols-[minmax(0,1fr)_92px_minmax(0,1fr)_112px] md:gap-3">
      <div className="min-w-0 overflow-hidden break-words" style={clampStyle}>
        {homeGoals}
      </div>
      <div aria-hidden="true" />
      <div className="min-w-0 overflow-hidden break-words text-right" style={clampStyle}>
        {awayGoals}
      </div>
      <div aria-hidden="true" className="hidden md:block" />
    </div>
  )
}

function BroadcastLine({ channel }: { channel?: string | null }) {
  if (!channel) return null

  return (
    <div className="mt-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-snug text-[#8d98a7]">
      TV: {channel}
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
  goalScorers,
  broadcastChannel,
}: MatchRowProps) {
  const isLive = status.includes('EN VIVO')
  const centerLabel = score === '- - -' ? minute || time || 'vs' : score

  return (
    <Link
      href={`/partido/${id}`}
      className="block border-b border-white/6 bg-[#111418] px-3 py-3 transition hover:bg-[#161a20] sm:px-4"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-center gap-2 md:grid-cols-[minmax(0,1fr)_92px_minmax(0,1fr)_112px] md:gap-3">
        <TeamBadge logo={homeLogo} name={home} />

        <div className="text-center">
          <div className={`rounded-lg border border-white/8 bg-[#0f1317] px-2 py-1 text-xs font-black text-white sm:text-sm ${isLive ? 'text-[#7ff0b2]' : ''}`}>
            {centerLabel}
          </div>
        </div>

        <TeamBadge logo={awayLogo} name={away} align="right" />

        <div className="hidden min-w-0 justify-end md:flex">
          <StatusBadge status={status} />
        </div>
      </div>

      <GoalScorersLine goalScorers={goalScorers} />
      <BroadcastLine channel={broadcastChannel} />

      <div className="mt-2 flex min-w-0 justify-end md:hidden">
        <StatusBadge status={status} />
      </div>
    </Link>
  )
}
