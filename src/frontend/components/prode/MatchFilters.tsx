'use client'

import { useMemo } from 'react'
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

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: FilterSelectProps) {
  return (
    <label className="hf-prode-filter-field">
      <span>{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={!options.length}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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
    <div className={`hf-card hf-prode-filters grid w-full min-w-0 gap-3 rounded-2xl p-3 md:p-4 ${
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
