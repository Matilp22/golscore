import Link from 'next/link'
import SafeImage from '@/frontend/components/SafeImage'

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
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide ${styles[label]}`}>
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
      className="block rounded-2xl border border-white/10 bg-zinc-900/85 p-3 shadow-lg shadow-black/20 transition hover:border-emerald-500/30"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{league}</p>
          <p className="mt-0.5 text-[10px] text-zinc-500">{country || minute || time}</p>
        </div>
        <Chip label={status} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden">
              <SafeImage
                src={homeLogo}
                alt={home}
                imageType="team"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                fallbackClassName="h-6 w-5"
              />
            </div>
            <span className="text-xs font-medium text-white md:text-sm">{home}</span>
          </div>
          <span className="text-base font-extrabold tracking-wide text-white">
            {score.split(' - ')[0] || '-'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden">
              <SafeImage
                src={awayLogo}
                alt={away}
                imageType="team"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                fallbackClassName="h-6 w-5"
              />
            </div>
            <span className="text-xs font-medium text-white md:text-sm">{away}</span>
          </div>
          <span className="text-base font-extrabold tracking-wide text-white">
            {score.split(' - ')[1] || '-'}
          </span>
        </div>
      </div>

      <div className="mt-2 border-t border-white/5 pt-2 text-[10px] text-zinc-500">
        Ver detalle del partido
      </div>
    </Link>
  )
}
