'use client'

import { useState } from 'react'

import FormationTeamPanel, {
  type FormationPanelPlayer,
  type LineupPanelTab,
} from '@/frontend/components/FormationTeamPanel'
import { useTranslations } from '@/frontend/components/LocaleProvider'

type LineupTabsTeam = {
  title: string
  coachName?: string
  starters: FormationPanelPlayer[]
  substitutes: FormationPanelPlayer[]
  align: 'left' | 'right'
}

type LineupTabsProps = {
  teams: LineupTabsTeam[]
}

function countPlayers(teams: LineupTabsTeam[], tab: LineupPanelTab) {
  return teams.reduce(
    (count, team) => count + (tab === 'starters' ? team.starters.length : team.substitutes.length),
    0
  )
}

function LineupTabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 flex-1 rounded-lg px-2 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] transition sm:px-3 ${
        active
          ? 'bg-[#163828] text-[#7ff0b2] shadow-[inset_0_0_0_1px_rgba(127,240,178,0.22)]'
          : 'text-[#8d98a7] hover:bg-white/5 hover:text-white'
      }`}
      aria-pressed={active}
    >
      <span>{label}</span>
      <span className="ml-1 text-[10px] opacity-75">({count})</span>
    </button>
  )
}

export default function LineupTabs({ teams }: LineupTabsProps) {
  const { t } = useTranslations()
  const startersCount = countPlayers(teams, 'starters')
  const substitutesCount = countPlayers(teams, 'substitutes')
  const [activeTab, setActiveTab] = useState<LineupPanelTab>(
    startersCount > 0 ? 'starters' : 'substitutes'
  )

  return (
    <div className="mt-3 md:mt-4" data-match-detail="lineup-tabs">
      <div className="mb-3 flex rounded-xl border border-white/6 bg-[#161a20] p-1">
        <LineupTabButton
          active={activeTab === 'starters'}
          label={t('lineup.starters')}
          count={startersCount}
          onClick={() => setActiveTab('starters')}
        />
        <LineupTabButton
          active={activeTab === 'substitutes'}
          label={t('lineup.substitutes')}
          count={substitutesCount}
          onClick={() => setActiveTab('substitutes')}
        />
      </div>

      <div className="rounded-2xl border border-white/8 bg-[#111418] p-2 sm:p-3 md:p-4">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-white/6 pb-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#8d98a7]">
          <span className="truncate text-left">{teams[0]?.title ?? t('prode.home')}</span>
          <span className="rounded-full border border-[#70ff9d]/20 bg-[#70ff9d]/10 px-2 py-1 text-[#70ff9d]">vs</span>
          <span className="truncate text-right">{teams[1]?.title ?? t('prode.away')}</span>
        </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
        {teams.map((team) => (
          <FormationTeamPanel
            key={team.title}
            title={team.title}
            coachName={team.coachName}
            starters={team.starters}
            substitutes={team.substitutes}
            align={team.align}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            showTabs={false}
            framed={false}
          />
        ))}
        </div>
      </div>
    </div>
  )
}
