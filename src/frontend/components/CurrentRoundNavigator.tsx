'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { TeamLogo } from '@/frontend/components/AssetImage'
import type { LeagueFixtureSummary } from '@/lib/api-football'
import type { AppLocale } from '@/shared/i18n/locales'
import { translateCountryName } from '@/shared/utils/country-names'
import { formatMatchScoreWithPenalties } from '@/shared/utils/match-display'
import { parseMatchDate } from '@/shared/utils/prediction-lock'

type RoundBlock = {
  round: string
  label: string
  days: Array<[string, LeagueFixtureSummary[]]>
}

type CurrentRoundNavigatorProps = {
  rounds: RoundBlock[]
  initialIndex: number
  locale?: AppLocale
  translateTeamNames?: boolean
}

function formatFixtureTime(date: string | null) {
  if (!date) return 'A programar'

  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(parseMatchDate(date))
}

function getMatchStatusLabel(match: LeagueFixtureSummary) {
  if (!match.date || ['TBD', 'TBA'].includes(match.statusShort)) return 'A programar'
  if (match.statusShort === 'NS') return formatFixtureTime(match.date)
  if (match.statusShort === 'FT') return 'Final'
  if (match.statusShort === 'HT') return 'ET'
  if (
    ['1H', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(match.statusShort)
  ) {
    return match.minute ? `${match.minute}'` : 'En vivo'
  }
  return match.statusShort
}

function getMatchScoreLabel(match: LeagueFixtureSummary) {
  if (match.goalsHome !== null || match.goalsAway !== null) {
    return formatMatchScoreWithPenalties({
      goalsHome: match.goalsHome,
      goalsAway: match.goalsAway,
      homePenaltyScore: match.homePenaltyScore,
      awayPenaltyScore: match.awayPenaltyScore,
      separator: '-',
    })
  }

  return '-'
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`h-4 w-4 transition duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  )
}

export default function CurrentRoundNavigator({
  rounds,
  initialIndex,
  locale = 'es',
  translateTeamNames = false,
}: CurrentRoundNavigatorProps) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex)
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const selectedRound = rounds[selectedIndex] || rounds[0]

  const canGoPrev = selectedIndex > 0
  const canGoNext = selectedIndex < rounds.length - 1

  const selectOptions = useMemo(
    () =>
      rounds.map((round, index) => ({
        index,
        label: round.label,
      })),
    [rounds]
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  if (!selectedRound) return null

  return (
    <section className="hf-current-round-card">
      <header className="hf-current-round-heading">
        <div className="hf-current-round-controls">
          <button
            type="button"
            onClick={() => canGoPrev && setSelectedIndex((current) => current - 1)}
            disabled={!canGoPrev}
            className="hf-current-round-step"
            aria-label="Fecha anterior"
          >
            <span className="text-lg font-bold">‹</span>
          </button>

          <div ref={wrapperRef} className="hf-current-round-select">
            <button
              type="button"
              onClick={() => setIsOpen((current) => !current)}
              className="hf-current-round-trigger"
              aria-expanded={isOpen}
              aria-haspopup="listbox"
            >
              <span className="truncate text-sm font-black md:text-base">
                {selectedRound.label}
              </span>
              <span aria-hidden="true">
                <ChevronIcon open={isOpen} />
              </span>
            </button>

            {isOpen ? (
              <div className="hf-current-round-menu">
                <div role="listbox" aria-label="Seleccionar fecha">
                  {selectOptions.map((option) => {
                    const isActive = option.index === selectedIndex

                    return (
                      <button
                        key={option.index}
                        type="button"
                        onClick={() => {
                          setSelectedIndex(option.index)
                          setIsOpen(false)
                        }}
                        className={isActive ? 'is-active' : ''}
                        role="option"
                        aria-selected={isActive}
                      >
                        <span className="font-semibold">{option.label}</span>
                        {isActive ? (
                          <span className="hf-current-round-selected" aria-hidden="true" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => canGoNext && setSelectedIndex((current) => current + 1)}
            disabled={!canGoNext}
            className="hf-current-round-step"
            aria-label="Fecha siguiente"
          >
            <span className="text-lg font-bold">›</span>
          </button>
        </div>
      </header>

      <div className="hf-current-round-body">
        <div className="hf-current-round-list">
          {selectedRound.days.map(([day, matches]) => (
            <div key={day} className="hf-current-round-day-group">
              <div className="hf-current-round-day">
                {day}
              </div>

              {matches.map((match) => {
                const homeDisplayName = translateTeamNames
                  ? translateCountryName(match.home, locale) || match.home
                  : match.home
                const awayDisplayName = translateTeamNames
                  ? translateCountryName(match.away, locale) || match.away
                  : match.away
                const rowClassName = 'hf-current-round-row'
                const rowContent = (
                  <>
                    <div className="hf-current-round-status">
                      {getMatchStatusLabel(match)}
                    </div>

                    <div className="hf-current-round-match">
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(86px,max-content)_minmax(0,1fr)] items-center gap-1.5">
                        <div className="flex items-center justify-end gap-1.5 text-right">
                          <span className="hf-current-round-team truncate font-semibold text-[#dce5ef]">{homeDisplayName}</span>
                          <TeamLogo
                            src={match.homeLogo}
                            alt={homeDisplayName}
                            size={16}
                            className="h-4 w-4 object-contain"
                            fallbackClassName="h-3.5 w-3"
                          />
                        </div>

                        <div className="hf-current-round-score">
                          {getMatchScoreLabel(match)}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <TeamLogo
                            src={match.awayLogo}
                            alt={awayDisplayName}
                            size={16}
                            className="h-4 w-4 object-contain"
                            fallbackClassName="h-3.5 w-3"
                          />
                          <span className="hf-current-round-team truncate font-semibold text-[#dce5ef]">{awayDisplayName}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )

                return typeof match.id === 'number' ? (
                  <Link
                    key={match.id}
                    href={`/partido/${match.id}`}
                    className={rowClassName}
                  >
                    {rowContent}
                  </Link>
                ) : (
                  <div
                    key={match.id}
                    className={`${rowClassName} is-disabled`}
                  >
                    {rowContent}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
