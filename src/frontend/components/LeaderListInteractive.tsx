'use client'

import Link from 'next/link'

import { PlayerPhoto } from '@/frontend/components/AssetImage'
import { useTranslations } from '@/frontend/components/LocaleProvider'
import type { LeaderStatType, TopPlayerRow } from '@/lib/api-football'
import { translateCountryName } from '@/shared/utils/country-names'

type LeaderListInteractiveProps = {
  title: string
  rows: TopPlayerRow[]
  accentClass: string
  leagueId?: number
  season?: number
  statType: LeaderStatType
  translateTeamNames?: boolean
}

export default function LeaderListInteractive({
  title,
  rows,
  accentClass,
  leagueId,
  season,
  statType,
  translateTeamNames = false,
}: LeaderListInteractiveProps) {
  const { locale, t } = useTranslations()
  const visibleRows = rows.slice(0, 10)

  return (
    <section className="hf-card hf-leader-list w-full overflow-hidden">
      <div className="hf-section-head hf-leader-list-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white md:text-lg">{title}</h2>
          <span className="hf-leader-list-count">
            Top {Math.min(rows.length, 10)}
          </span>
        </div>
      </div>

      <div className="hf-leader-list-body">
        {rows.length ? (
          <div className="hf-leader-list-rows">
            {visibleRows.map((row, index) => {
              const displayIndex = index + 1
              const href =
                row.playerId && leagueId && season
                  ? `/jugador/${row.playerId}?leagueId=${leagueId}&season=${season}&statType=${statType}&expectedCount=${row.value}&name=${encodeURIComponent(row.name)}&photo=${encodeURIComponent(row.photo || '')}&teamId=${row.teamId || ''}&teamName=${encodeURIComponent(row.teamName || '')}&teamLogo=${encodeURIComponent(row.teamLogo || '')}`
                  : null
              const displayTeamName = row.teamName
                ? translateTeamNames
                  ? translateCountryName(row.teamName, locale) || row.teamName
                  : row.teamName
                : t('common.noTeam')

              const content = (
                <>
                  <div className="hf-leader-list-identity">
                    <span className="hf-leader-list-rank">{displayIndex}</span>
                    <PlayerPhoto
                      src={row.photo}
                      alt={row.name}
                      size={30}
                      className="hf-leader-list-photo object-cover"
                      fallbackClassName="hf-leader-list-photo"
                    />
                    <div className="min-w-0">
                      <p className="hf-leader-list-name">{row.name}</p>
                      <p className="hf-leader-list-team">
                        {displayTeamName}
                      </p>
                      {row.details ? (
                        <p className="hf-leader-list-detail">
                          {row.details}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <span className={`hf-leader-list-value ${accentClass}`}>{row.value}</span>
                </>
              )

              if (!href) {
                return (
                  <div
                    key={`${row.playerId || row.name}-${index}`}
                    className="hf-leader-list-row is-disabled"
                  >
                    {content}
                  </div>
                )
              }

              return (
                <Link
                  key={`${row.playerId || row.name}-${index}`}
                  href={href}
                  className="hf-leader-list-row"
                >
                  {content}
                </Link>
              )
            })}

          </div>
        ) : (
          <p className="text-sm text-[#8d98a7]">{t('common.noRankingData')}</p>
        )}
      </div>
    </section>
  )
}
