'use client'

import { TeamLogo } from '@/frontend/components/AssetImage'
import { useTranslations } from '@/frontend/components/LocaleProvider'
import type { GroupStanding } from '@/frontend/types/prode'
import {
  LEGEND_TONE_CLASSES,
  ROW_TONE_CLASSES,
  getCompetitionLegendItems,
  getCompetitionRule,
  getStandingRuleForRank,
  type RuleTone,
} from '@/shared/config/competition-rules'
import { translateCountryName } from '@/shared/utils/country-names'

type WorldCupGroupStandingsProps = {
  group: GroupStanding | null
  isLoading?: boolean
}

const worldCupRule = getCompetitionRule('selecciones-mundial')
const worldCupLegendItems = getCompetitionLegendItems(worldCupRule).map((item) => ({
  label: item.label,
  tone: LEGEND_TONE_CLASSES[item.tone as RuleTone],
}))

function translateLegendLabel(label: string, locale: string) {
  const normalized = label.toLowerCase()

  if (normalized.includes('octavos')) {
    if (locale === 'en') return 'Qualifies for round of 16'
    if (locale === 'pt') return 'Classifica para as oitavas'
    if (locale === 'fr') return 'Qualifié pour les huitièmes'
  }

  if (normalized.includes('tercer')) {
    if (locale === 'en') return 'Best third-placed teams'
    if (locale === 'pt') return 'Melhores terceiros'
    if (locale === 'fr') return 'Meilleurs troisiemes'
  }

  return label
}

function getRowAccent(rank: number) {
  const rule = getStandingRuleForRank(worldCupRule, rank)

  return rule ? ROW_TONE_CLASSES[rule.tone] : 'border-l-transparent'
}

function TableLegend({ items }: { items: Array<{ label: string; tone: string }> }) {
  if (!items.length) return null

  return (
    <div className="mt-4 space-y-2 border-t border-white/6 pt-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs text-[#dce5ef]">
          <span className={`h-3 w-3 rounded-full ${item.tone}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function WorldCupGroupStandings({
  group,
  isLoading = false,
}: WorldCupGroupStandingsProps) {
  const { locale, t } = useTranslations()
  const legendItems = worldCupLegendItems.map((item) => ({
    ...item,
    label: translateLegendLabel(item.label, locale),
  }))

  if (isLoading) {
    return (
      <section className="hf-card hf-prode-world-group-table w-full rounded-2xl p-4">
        <h2 className="text-lg font-black text-white">{t('prode.groupStandingsTitle')}</h2>
        <p className="mt-2 text-sm text-[#8d98a7]">{t('prode.loadingGroupStandings')}</p>
      </section>
    )
  }

  return (
    <section className="hf-card hf-prode-world-group-table w-full min-w-0 overflow-hidden rounded-2xl">
      <div className="hf-section-head px-3 py-3 sm:px-4">
        <h2 className="text-lg font-black text-white">
          {t('prode.groupStandingsTitle')}{group ? ` - ${group.label}` : ''}
        </h2>
      </div>

      {!group?.rows.length ? (
        <div className="p-4">
          <p className="text-sm text-[#8d98a7]">{t('prode.noGroupStandings')}</p>
        </div>
      ) : (
        <div className="p-0">
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed text-[10.5px] sm:text-[12px]">
              <colgroup>
                <col style={{ width: '7%' }} />
                <col style={{ width: '35%' }} />
                <col style={{ width: '7.25%' }} />
                <col style={{ width: '7.25%' }} />
                <col style={{ width: '7.25%' }} />
                <col style={{ width: '7.25%' }} />
                <col style={{ width: '7.25%' }} />
                <col style={{ width: '7.25%' }} />
                <col style={{ width: '7.25%' }} />
                <col style={{ width: '7.25%' }} />
              </colgroup>
              <thead className="text-left text-[#8d98a7]">
                <tr className="border-b border-white/6">
                  <th className="px-0.5 py-1.5 font-semibold sm:px-1">#</th>
                  <th className="px-0.5 py-1.5 font-semibold sm:px-1">{t('prode.team')}</th>
                  <th className="px-0.5 py-1.5 text-center font-semibold sm:px-1">PTS</th>
                  <th className="px-0.5 py-1.5 text-center font-semibold sm:px-1">PJ</th>
                  <th className="px-0.5 py-1.5 text-center font-semibold sm:px-1">PG</th>
                  <th className="px-0.5 py-1.5 text-center font-semibold sm:px-1">PE</th>
                  <th className="px-0.5 py-1.5 text-center font-semibold sm:px-1">PP</th>
                  <th className="px-0.5 py-1.5 text-center font-semibold sm:px-1">GF</th>
                  <th className="px-0.5 py-1.5 text-center font-semibold sm:px-1">GC</th>
                  <th className="px-0.5 py-1.5 text-center font-semibold sm:px-1">DG</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, index) => (
                  <tr
                    key={`${row.teamId || row.teamName}-${index}`}
                    className={`border-b border-l-2 border-white/6 text-[#dce5ef] last:border-b-0 ${getRowAccent(row.rank || index + 1)}`}
                  >
                    <td className="px-0.5 py-1.5 font-semibold sm:px-1">
                      {row.rank || index + 1}
                    </td>
                    <td className="px-0.5 py-1.5 sm:px-1">
                      <div className="flex min-w-0 items-center gap-1">
                        <TeamLogo
                          src={row.teamLogo}
                          alt={translateCountryName(row.teamName, locale)}
                          size={16}
                          className="h-4 w-4 object-contain"
                          fallbackClassName="h-3.5 w-3"
                          unoptimized
                        />
                        <span className="min-w-0 truncate font-medium text-[10.5px] sm:text-[12px]">
                          {translateCountryName(row.teamName, locale)}
                        </span>
                      </div>
                    </td>
                    <td className="px-0.5 py-1.5 text-center font-black text-white sm:px-1">
                      {row.points}
                    </td>
                    <td className="px-0.5 py-1.5 text-center sm:px-1">{row.played}</td>
                    <td className="px-0.5 py-1.5 text-center sm:px-1">{row.won}</td>
                    <td className="px-0.5 py-1.5 text-center sm:px-1">{row.drawn}</td>
                    <td className="px-0.5 py-1.5 text-center sm:px-1">{row.lost}</td>
                    <td className="px-0.5 py-1.5 text-center sm:px-1">{row.goalsFor}</td>
                    <td className="px-0.5 py-1.5 text-center sm:px-1">{row.goalsAgainst}</td>
                    <td className="px-0.5 py-1.5 text-center sm:px-1">{row.goalDifference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-3 pb-3 sm:px-4">
            <TableLegend items={legendItems} />
          </div>
        </div>
      )}
    </section>
  )
}
