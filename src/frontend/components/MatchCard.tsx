'use client'

import Link from 'next/link'
import { TeamLogo } from '@/frontend/components/AssetImage'
import { useTranslations } from '@/frontend/components/LocaleProvider'
import { translateCountryName } from '@/shared/utils/country-names'
import { getTeamDisplayName } from '@/shared/utils/team-display'

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
  const { locale, t } = useTranslations()
  const countryLabel = country ? translateCountryName(country, locale) || country : null
  const homeDisplayName = getTeamDisplayName({ name: home, league, country, locale })
  const awayDisplayName = getTeamDisplayName({ name: away, league, country, locale })

  return (
    <Link
      href={`/partido/${id}`}
      className="hf-card hf-card-hover block rounded-2xl p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{league}</p>
          <p className="mt-0.5 text-[10px] text-zinc-500">{countryLabel || minute || time}</p>
        </div>
        <Chip label={status} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden">
              <TeamLogo
                src={homeLogo}
                alt={homeDisplayName}
                size={28}
                className="h-7 w-7 object-contain"
                fallbackClassName="h-6 w-5"
              />
            </div>
            <span className="text-xs font-medium text-white md:text-sm">{homeDisplayName}</span>
          </div>
          <span className="text-base font-extrabold tracking-wide text-white">
            {score.split(' - ')[0] || '-'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden">
              <TeamLogo
                src={awayLogo}
                alt={awayDisplayName}
                size={28}
                className="h-7 w-7 object-contain"
                fallbackClassName="h-6 w-5"
              />
            </div>
            <span className="text-xs font-medium text-white md:text-sm">{awayDisplayName}</span>
          </div>
          <span className="text-base font-extrabold tracking-wide text-white">
            {score.split(' - ')[1] || '-'}
          </span>
        </div>
      </div>

      <div className="mt-2 border-t border-white/5 pt-2 text-[10px] text-zinc-500">
        {t('match.viewDetail')}
      </div>
    </Link>
  )
}
