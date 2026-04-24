import Image from 'next/image'
import Link from 'next/link'

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
    <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${classes}`}>
      {status}
    </span>
  )
}

function TeamBadge({
  logo,
  name,
}: {
  logo?: string
  name: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-[#161a20] ring-1 ring-white/6">
        {logo ? (
          <Image src={logo} alt={name} width={20} height={20} className="h-5 w-5 object-contain" />
        ) : (
          <span className="text-[9px] text-zinc-500">•</span>
        )}
      </div>
      <span className="truncate text-[13px] font-medium text-[#f2f4f7]">{name}</span>
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
}: MatchRowProps) {
  const [homeGoals, awayGoals] = score.split(' - ')
  const isLive = status.includes('EN VIVO')

  return (
    <Link
      href={`/partido/${id}`}
      className="block border-b border-white/6 bg-[#111418] px-3 py-3 transition hover:bg-[#161a20]"
    >
      <div className="grid grid-cols-[56px_1fr_auto] items-center gap-3 md:grid-cols-[64px_1fr_72px_120px]">
        <div className="text-center">
          <div className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${isLive ? 'text-[#7ff0b2]' : 'text-[#9ca3af]'}`}>
            {minute || time}
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <TeamBadge logo={homeLogo} name={home} />
          <TeamBadge logo={awayLogo} name={away} />
        </div>

        <div className="text-right md:text-center">
          <div className="grid min-w-[44px] grid-cols-2 gap-3 text-sm font-bold text-white">
            <span>{homeGoals ?? '-'}</span>
            <span>{awayGoals ?? '-'}</span>
          </div>
        </div>

        <div className="hidden justify-end md:flex">
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="mt-2 flex justify-end md:hidden">
        <StatusBadge status={status} />
      </div>
    </Link>
  )
}
