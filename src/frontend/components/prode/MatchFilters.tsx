'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from '@/frontend/components/LocaleProvider'
import type { League, RoundOption } from '@/frontend/types/prode'
import { getTournamentDisplayName } from '@/shared/i18n/locales'

type MatchFiltersProps = {
  leagues: League[]
  rounds: RoundOption[]
  groups?: Array<{ value: string; label: string }>
  selectedLeagueId: string | null
  selectedRound: string | null
  selectedGroup?: string | null
  showGroupFilter?: boolean
  onLeagueChange: (leagueId: string | null) => void
  onRoundChange: (round: string | null) => void
  onGroupChange?: (group: string | null) => void
}

type FilterSelectProps = {
  label: string
  value: string | null
  placeholder: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
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

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: FilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const selectedOption = options.find((option) => option.value === value) ?? null

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

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9adfb8]">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="hf-input mt-1.5 flex h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left transition hover:border-[#70ff9d]/25"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={`truncate text-sm font-semibold ${selectedOption ? 'text-white' : 'text-[#8d98a7]'}`}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span className="shrink-0 text-[#8fa0b1]">
          <ChevronIcon open={isOpen} />
        </span>
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-full overflow-hidden rounded-xl border border-[#70ff9d]/15 bg-[#0b1412] shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <div className="max-h-72 overflow-y-auto py-1.5">
            {options.map((option) => {
              const isActive = option.value === value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition ${
                    isActive
                      ? 'bg-[#70ff9d]/10 text-white'
                      : 'text-[#dce5ef] hover:bg-[#70ff9d]/10'
                  }`}
                  role="option"
                  aria-selected={isActive}
                >
                  <span className="font-semibold">{option.label}</span>
                  {isActive ? <span className="h-2 w-2 rounded-full bg-[#70ff9d]" /> : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function MatchFilters({
  leagues,
  rounds,
  groups = [],
  selectedLeagueId,
  selectedRound,
  selectedGroup = null,
  showGroupFilter = false,
  onLeagueChange,
  onRoundChange,
  onGroupChange,
}: MatchFiltersProps) {
  const { locale, t } = useTranslations()
  const leagueOptions = useMemo(
    () =>
      leagues.map((league) => {
        const displayName = getTournamentDisplayName(league.slug ?? '', league.name, locale)
        const normalizedName = displayName.trim().toLowerCase()
        const seasonLabel = String(league.season)

        return {
          value: league.id,
          label: normalizedName.endsWith(seasonLabel.toLowerCase())
            ? displayName
            : `${displayName} ${league.season}`,
        }
      }),
    [leagues, locale]
  )

  const roundOptions = useMemo(
    () =>
      rounds.map((round) => ({
        value: round.value,
        label: round.label,
      })),
    [rounds]
  )
  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        value: group.value,
        label: group.label,
      })),
    [groups]
  )

  return (
    <div className={`hf-card grid w-full min-w-0 gap-3 rounded-2xl p-3 md:p-4 ${
      showGroupFilter ? 'md:grid-cols-2 2xl:grid-cols-3' : 'md:grid-cols-2'
    }`}>
        <FilterSelect
        label={t('prode.league')}
        value={selectedLeagueId}
        placeholder={t('prode.chooseTournament')}
        options={leagueOptions}
        onChange={onLeagueChange}
      />
      <FilterSelect
        label={t('prode.roundPhase')}
        value={selectedRound}
        placeholder={t('prode.noRound')}
        options={roundOptions}
        onChange={onRoundChange}
      />
      {showGroupFilter ? (
        <FilterSelect
          label={t('prode.group')}
          value={selectedGroup}
          placeholder={t('prode.noGroup')}
          options={groupOptions}
          onChange={(group) => onGroupChange?.(group)}
        />
      ) : null}
    </div>
  )
}
