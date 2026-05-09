'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { League, RoundOption } from '@/frontend/types/prode'

type MatchFiltersProps = {
  leagues: League[]
  rounds: RoundOption[]
  selectedLeagueId: string | null
  selectedRound: string | null
  onLeagueChange: (leagueId: string | null) => void
  onRoundChange: (round: string | null) => void
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
        className="mt-1.5 flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/8 bg-[#0d1217] px-3 text-left text-white transition hover:border-[#7ff0b2]/25 hover:bg-[#111820]"
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
        <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-full overflow-hidden rounded-xl border border-white/8 bg-[#11161b] shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
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
                      ? 'bg-[#16251d] text-white'
                      : 'text-[#dce5ef] hover:bg-[#161d24]'
                  }`}
                  role="option"
                  aria-selected={isActive}
                >
                  <span className="font-semibold">{option.label}</span>
                  {isActive ? <span className="h-2 w-2 rounded-full bg-[#7ff0b2]" /> : null}
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
  selectedLeagueId,
  selectedRound,
  onLeagueChange,
  onRoundChange,
}: MatchFiltersProps) {
  const leagueOptions = useMemo(
    () =>
      leagues.map((league) => {
        const normalizedName = league.name.trim().toLowerCase()
        const seasonLabel = String(league.season)

        return {
          value: league.id,
          label: normalizedName.endsWith(seasonLabel.toLowerCase())
            ? league.name
            : `${league.name} ${league.season}`,
        }
      }),
    [leagues]
  )

  const roundOptions = useMemo(
    () =>
      rounds.map((round) => ({
        value: round.value,
        label: round.label,
      })),
    [rounds]
  )

  return (
    <div className="grid w-full min-w-0 gap-3 rounded-2xl border border-white/8 bg-[#10151a]/95 p-3 shadow-[0_10px_24px_rgba(0,0,0,0.12)] md:grid-cols-2 md:p-4">
      <FilterSelect
        label="Liga"
        value={selectedLeagueId}
        placeholder="Elegí un torneo"
        options={leagueOptions}
        onChange={onLeagueChange}
      />
      <FilterSelect
        label="Fecha"
        value={selectedRound}
        placeholder="Sin fecha disponible"
        options={roundOptions}
        onChange={onRoundChange}
      />
    </div>
  )
}
