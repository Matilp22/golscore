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
    <section className="hf-card hf-current-round-card w-full overflow-hidden rounded-2xl">
      <div className="hf-section-head px-2.5 py-2 md:px-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => canGoPrev && setSelectedIndex((current) => current - 1)}
            disabled={!canGoPrev}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Fecha anterior"
          >
            <span className="text-lg font-bold">‹</span>
          </button>

          <div ref={wrapperRef} className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setIsOpen((current) => !current)}
            className="hf-button-secondary mx-auto flex min-w-[160px] max-w-full items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-white"
              aria-expanded={isOpen}
              aria-haspopup="listbox"
            >
              <span className="truncate text-sm font-black md:text-base">
                {selectedRound.label}
              </span>
              <span className="text-[#8fa0b1]">
                <ChevronIcon open={isOpen} />
              </span>
            </button>

            {isOpen ? (
              <div className="absolute left-1/2 top-[calc(100%+10px)] z-20 w-[240px] max-w-[90vw] -translate-x-1/2 overflow-hidden rounded-2xl border border-[#70ff9d]/15 bg-[#0b1412] shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                <div className="max-h-72 overflow-y-auto py-2">
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
                        className={`flex w-full items-center justify-between px-4 py-3 text-left transition ${
                          isActive
                            ? 'bg-[#162028] text-white'
                            : 'text-[#dce5ef] hover:bg-[#161d24]'
                        }`}
                        role="option"
                        aria-selected={isActive}
                      >
                        <span className="font-semibold">{option.label}</span>
                        {isActive ? (
                          <span className="h-2.5 w-2.5 rounded-full bg-[#7ff0b2]" />
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Fecha siguiente"
          >
            <span className="text-lg font-bold">›</span>
          </button>
        </div>
      </div>

      <div className="p-2 md:p-3">
        <div className="hf-current-round-list w-full overflow-hidden rounded-xl border border-white/8 bg-[#11161b]">
          {selectedRound.days.map(([day, matches]) => (
            <div key={day} className="border-b border-white/10 last:border-b-0">
              <div className="hf-current-round-day border-b border-white/8 bg-[#141a20] px-3 py-1.5 text-center text-xs font-bold text-white last:border-b-0">
                {day}
              </div>

              {matches.map((match) => {
                const homeDisplayName = translateTeamNames
                  ? translateCountryName(match.home, locale) || match.home
                  : match.home
                const awayDisplayName = translateTeamNames
                  ? translateCountryName(match.away, locale) || match.away
                  : match.away
                const rowClassName =
                  'grid grid-cols-[58px_minmax(0,1fr)] items-center border-b border-white/8 text-xs transition last:border-b-0 md:grid-cols-[64px_minmax(0,1fr)]'
                const rowContent = (
                  <>
                    <div className="hf-current-round-status border-r border-white/8 px-2 py-1.5 text-center font-bold text-[#7ff0b2]">
                      {getMatchStatusLabel(match)}
                    </div>

                    <div className="px-2 py-1.5">
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

                        <div className="hf-current-round-score whitespace-nowrap text-center text-sm font-black text-white">
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
                    className={`${rowClassName} hover:bg-[#151b21] focus-visible:bg-[#151b21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ff0b2]/60 focus-visible:ring-inset`}
                  >
                    {rowContent}
                  </Link>
                ) : (
                  <div
                    key={match.id}
                    className={`${rowClassName} cursor-default bg-[#11161b]`}
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
