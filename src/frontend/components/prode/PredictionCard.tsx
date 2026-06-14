'use client'

import { useTranslations } from '@/frontend/components/LocaleProvider'
import type { Match, Prediction } from '@/frontend/types/prode'
import { getTeamDisplayName } from '@/shared/utils/team-display'

type PredictionCardProps = {
  prediction: Prediction
  match?: Match
}

export default function PredictionCard({
  prediction,
  match,
}: PredictionCardProps) {
  const { locale, t } = useTranslations()
  const homeName = match?.homeTeam?.name
    ? getTeamDisplayName({
        name: match.homeTeam.name,
        league: match.league?.name,
        country: match.league?.country,
        locale,
      })
    : t('prode.home')
  const awayName = match?.awayTeam?.name
    ? getTeamDisplayName({
        name: match.awayTeam.name,
        league: match.league?.name,
        country: match.league?.country,
        locale,
      })
    : t('prode.away')

  return (
    <div className="rounded-xl border border-white/8 bg-[#0f1317] px-3 py-2 text-sm">
      <p className="font-bold text-white">
        {homeName} {prediction.predictedHomeScore} - {prediction.predictedAwayScore}{' '}
        {awayName}
      </p>
      <p className="mt-1 text-xs text-[#8d98a7]">
        #{prediction.matchId} {'\u00b7'} {prediction.points ?? 0} {t('common.pointsAbbr')}
        {prediction.exactHit
          ? ` ${t('common.exact')}`
          : prediction.partialHit
            ? ` ${t('common.partial')}`
            : ''}
      </p>
    </div>
  )
}
