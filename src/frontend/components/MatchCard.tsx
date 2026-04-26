import Image from 'next/image'
import Link from 'next/link'

type MatchCardProps = {
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

function Chip({ label }: { label: string }) {
  const styles: Record<string, string> = {
    'EN VIVO': 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    ENTRETIEMPO: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30',
    PRÓXIMO: 'bg-slate-500/20 text-slate-200 border border-slate-500/30',
  }

  return (
    <span className={`rounded-full px-3 py-1 text-[10px] font-bold tracking-wide ${styles[label]}`}>
      {label}
    </span>
  )
}

export default function MatchCard({
  id = 1,
  league,
  country,
  time,
  minute,
  home,
  away,
  homeLogo,
  awayLogo,
  score,
  status,
}: MatchCardProps) {
  return (
    <Link
      href={`/partido/${id}`}
      className="block rounded-3xl border border-white/10 bg-zinc-900/85 p-5 shadow-lg shadow-black/20 transition hover:border-emerald-500/30"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">{league}</p>
          <p className="mt-1 text-xs text-zinc-500">{country || minute || time}</p>
        </div>
        <Chip label={status} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden">
              {homeLogo ? (
                <Image
                  src={homeLogo}
                  alt={home}
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <span>•</span>
              )}
            </div>
            <span className="text-sm font-medium text-white md:text-base">{home}</span>
          </div>
          <span className="text-xl font-extrabold tracking-wide text-white">
            {score.split(' - ')[0] || '-'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden">
              {awayLogo ? (
                <Image
                  src={awayLogo}
                  alt={away}
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <span>•</span>
              )}
            </div>
            <span className="text-sm font-medium text-white md:text-base">{away}</span>
          </div>
          <span className="text-xl font-extrabold tracking-wide text-white">
            {score.split(' - ')[1] || '-'}
          </span>
        </div>
      </div>

      <div className="mt-4 border-t border-white/5 pt-3 text-xs text-zinc-500">
        Ver detalle del partido
      </div>
    </Link>
  )
}
