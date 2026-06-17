'use client'

import { useState } from 'react'

import { useTranslations } from '@/frontend/components/LocaleProvider'
import { formatEventMinute } from '@/shared/utils/event-minute'

type TeamStyle = {
  shirt: string
  text: string
  border: string
}

export type LineupPanelTab = 'starters' | 'substitutes'

export type FormationPanelPlayer = {
  id: string
  name: string
  number?: number
  position?: string
  photo?: string
  style: TeamStyle
  isCaptain?: boolean
  goals?: number
  penaltyGoals?: number
  ownGoals?: number
  missedPenalties?: number
  yellowCards?: number
  redCards?: number
  replacedPlayerName?: string
  substitutionLabel?: string
  substitutionDirection?: 'in' | 'out'
  substitutionMinute?: number | null
  substitutionExtraMinute?: number | null
}

type FormationTeamPanelProps = {
  title: string
  coachName?: string
  starters: FormationPanelPlayer[]
  substitutes: FormationPanelPlayer[]
  align: 'left' | 'right'
  activeTab?: LineupPanelTab
  onActiveTabChange?: (tab: LineupPanelTab) => void
  showTabs?: boolean
  framed?: boolean
}

function CaptainBadge() {
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-[#f3d36c] bg-[#5b4a16] px-1 text-[9px] font-black uppercase tracking-[0.04em] text-[#ffe38a] shadow-[0_0_0_1px_rgba(0,0,0,0.28)]">
      C
    </span>
  )
}

function Shirt({ number, style }: { number?: number | string; style: TeamStyle }) {
  return (
    <div
      className="flex h-7 w-6 items-center justify-center border-2 text-[9px] font-black shadow-md sm:h-8 sm:w-7 sm:text-[10px]"
      style={{
        backgroundColor: style.shirt,
        color: style.text,
        borderColor: style.border,
        clipPath:
          'polygon(18% 0%, 36% 0%, 40% 12%, 60% 12%, 64% 0%, 82% 0%, 100% 18%, 86% 28%, 86% 100%, 14% 100%, 14% 28%, 0% 18%)',
      }}
    >
      {number || ''}
    </div>
  )
}

function TinyEventBadges({
  goals = 0,
  penaltyGoals = 0,
  ownGoals = 0,
  missedPenalties = 0,
  yellowCards = 0,
  redCards = 0,
}: {
  goals?: number
  penaltyGoals?: number
  ownGoals?: number
  missedPenalties?: number
  yellowCards?: number
  redCards?: number
}) {
  if (!goals && !penaltyGoals && !ownGoals && !missedPenalties && !yellowCards && !redCards) {
    return null
  }

  const ballIcon = (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-[13px] w-[13px] overflow-visible">
      <circle cx="16" cy="16" r="13.4" fill="#f8fafc" stroke="#0f1317" strokeWidth="1.6" />
      <path d="M7.2 22.3c4.8 3.8 11.1 4.3 16.7.2" fill="none" stroke="#d7dbe0" strokeLinecap="round" strokeWidth="2.2" />
      <path
        d="M6.1 9.2c6.8-3 13.6-1.4 20.2 4.8M25.9 8.3c-2.4 6.9-7.3 11.4-14.6 13.4M25.5 22.9c-6.7 2.7-13.4.9-19.7-5.4M6.4 24.1c2.2-6.8 7-11.2 14.5-13.3"
        fill="none"
        stroke="#0a0a0a"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M9.1 11.2c5-2.2 9.8-1.1 14.6 3.2M23.6 11c-2.1 5-5.7 8.3-11 9.8M23 21.1c-5.1 1.8-9.9.5-14.5-3.7M9 21.5c1.8-4.9 5.4-8.2 10.9-9.8"
        fill="none"
        stroke="#7a7f86"
        strokeLinecap="round"
        strokeWidth="1.05"
      />
    </svg>
  )

  return (
    <div className="flex items-center gap-1">
      {goals ? (
        <span className="inline-flex min-h-3.5 min-w-3.5 items-center justify-center text-[#7ff0b2]">
          {ballIcon}
          {goals > 1 ? <span className="ml-0.5 text-[8px] font-bold">{goals}</span> : null}
        </span>
      ) : null}
      {penaltyGoals ? (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-[#7ff0b2]" title="Gol de penal">
          <span className="relative inline-flex h-4 w-5 items-center justify-center text-white">
            <span className="absolute inset-x-0 top-[1px] h-2.5 rounded-t-[2px] border-x border-t border-current" />
            <span className="relative scale-[0.62]">{ballIcon}</span>
          </span>
          {penaltyGoals > 1 ? <span>{penaltyGoals}</span> : null}
        </span>
      ) : null}
      {ownGoals ? (
        <span className="inline-flex rounded bg-[#3b1919] px-1 py-0.5 text-[8px] font-black uppercase leading-none text-[#ffb3b3]" title="Gol en contra">
          e/c{ownGoals > 1 ? ` ${ownGoals}` : ''}
        </span>
      ) : null}
      {missedPenalties ? (
        <span className="relative inline-flex h-4 w-5 items-center justify-center text-[#ffb3b3]" title="Penal errado">
          <span className="absolute inset-x-0 top-[1px] h-2.5 rounded-t-[2px] border-x border-t border-current" />
          <span className="absolute h-[1.5px] w-5 rotate-45 bg-[#ff5f5f]" />
          <span className="absolute h-[1.5px] w-5 -rotate-45 bg-[#ff5f5f]" />
        </span>
      ) : null}
      {yellowCards ? (
        <span className="inline-block h-[13px] w-[9px] rounded-[2px] bg-[#f3d36c]" />
      ) : null}
      {redCards ? (
        <span className="inline-block h-[13px] w-[9px] rounded-[2px] bg-[#ef4444]" />
      ) : null}
    </div>
  )
}

function translatePosition(position?: string) {
  const normalized = (position || '').trim().toUpperCase()

  if (normalized === 'G') return 'Arquero'
  if (normalized === 'D') return 'Defensor'
  if (normalized === 'M') return 'Mediocampista'
  if (normalized === 'F' || normalized === 'A' || normalized === 'S') return 'Delantero'

  return position || null
}

function translatePositionShort(position?: string) {
  const normalized = (position || '').trim().toUpperCase()

  if (normalized === 'G') return 'ARQ'
  if (normalized === 'D') return 'DEF'
  if (normalized === 'M') return 'MED'
  if (normalized === 'F' || normalized === 'A' || normalized === 'S') return 'DEL'

  return normalized || null
}

function hasSubstitutionMinute(value?: number | null) {
  return value !== null && value !== undefined
}

export default function FormationTeamPanel({
  title,
  coachName,
  starters,
  substitutes,
  align,
  activeTab,
  onActiveTabChange,
  showTabs = true,
  framed = true,
}: FormationTeamPanelProps) {
  const { t } = useTranslations()
  const defaultTab = starters.length ? 'starters' : 'substitutes'
  const [internalActiveTab, setInternalActiveTab] = useState<LineupPanelTab>(defaultTab)
  const selectedTab = activeTab ?? internalActiveTab
  const activePlayers = selectedTab === 'starters' ? starters : substitutes
  const setSelectedTab = onActiveTabChange ?? setInternalActiveTab

  return (
    <div
      className={
        framed
          ? 'w-full rounded-2xl border border-white/8 bg-[#111418] p-2 sm:p-3 md:p-4'
          : 'w-full min-w-0 p-0'
      }
    >
      <div className={`${align === 'right' ? 'text-right' : 'text-left'}`}>
        <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-[#f3f6fa]">{title}</h4>
      </div>

      <div className="mt-2 rounded-xl border border-white/6 bg-[#161a20] px-2 py-1.5 md:mt-3 md:px-3 md:py-2">
        <p className="text-[11px] uppercase tracking-wide text-[#8d98a7]">{t('lineup.coach')}</p>
        <p className="mt-1 truncate text-xs font-semibold text-white sm:text-sm">
          {coachName || t('common.notAvailable')}
        </p>
      </div>

      <div className="mt-3">
        {showTabs ? (
          <div
            className={`mb-2 flex rounded-xl border border-white/6 bg-[#161a20] p-1 ${
              align === 'right' ? 'justify-end' : 'justify-start'
            }`}
          >
            <LineupTabButton
              active={selectedTab === 'starters'}
              label={t('lineup.starters')}
              count={starters.length}
              onClick={() => setSelectedTab('starters')}
            />
            <LineupTabButton
              active={selectedTab === 'substitutes'}
              label={t('lineup.substitutes')}
              count={substitutes.length}
              onClick={() => setSelectedTab('substitutes')}
            />
          </div>
        ) : null}

        <PlayerSection
          players={activePlayers}
          align={align}
        />
      </div>
    </div>
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

function PlayerSection({
  players,
  align,
}: {
  players: FormationPanelPlayer[]
  align: 'left' | 'right'
}) {
  const { t } = useTranslations()

  return (
    <section>
      <div className="space-y-1.5">
        {players.length ? (
          players.map((player) => (
            <PlayerRow key={player.id} player={player} align={align} />
          ))
        ) : (
          <p className="rounded-xl border border-white/6 bg-[#161a20] px-2 py-2 text-sm text-[#8d98a7]">
            {t('lineup.noPlayers')}
          </p>
        )}
      </div>
    </section>
  )
}

function PlayerRow({
  player,
  align,
}: {
  player: FormationPanelPlayer
  align: 'left' | 'right'
}) {
  return (
    <div
      data-match-detail="lineup-player"
      className={`flex min-w-0 items-center gap-1.5 rounded-xl border border-white/6 bg-[#161a20] px-1.5 py-1.5 md:gap-2.5 md:px-3 ${
        align === 'right' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      <div className="relative flex-shrink-0">
        {player.isCaptain ? (
          <div className="absolute -left-1.5 top-1/2 z-10 -translate-y-1/2">
            <CaptainBadge />
          </div>
        ) : null}
        <Shirt number={player.number} style={player.style} />
      </div>

      <div className={`min-w-0 flex-1 overflow-hidden ${align === 'right' ? 'text-right' : 'text-left'}`}>
        <p className="truncate text-[11px] font-semibold leading-tight text-white sm:text-[13px]">
          {player.name}
        </p>
        {translatePosition(player.position) ? (
          <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.06em] text-[#8d98a7] sm:text-[10px]">
            <span className="sm:hidden">{translatePositionShort(player.position)}</span>
            <span className="hidden sm:inline">{translatePosition(player.position)}</span>
          </p>
        ) : null}
        {player.replacedPlayerName && player.substitutionLabel ? (
          <div className="mt-0.5 leading-tight">
            <p
              className={`text-[10px] font-black ${
                player.substitutionDirection === 'in'
                  ? 'text-[#7ff0b2]'
                  : 'text-[#ff8f8f]'
              }`}
            >
              {player.substitutionDirection === 'in' ? <>&uarr;</> : <>&darr;</>}{' '}
              {hasSubstitutionMinute(player.substitutionMinute)
                ? formatEventMinute(player.substitutionMinute, player.substitutionExtraMinute)
                : ''}
            </p>
            <p className="truncate text-[9px] text-[#9fb0c2] sm:text-[10px]">
              {player.substitutionLabel} {player.replacedPlayerName}
            </p>
          </div>
        ) : null}
      </div>

      <div className="max-w-[46%] shrink-0">
        <TinyEventBadges
          goals={player.goals}
          penaltyGoals={player.penaltyGoals}
          ownGoals={player.ownGoals}
          missedPenalties={player.missedPenalties}
          yellowCards={player.yellowCards}
          redCards={player.redCards}
        />
      </div>
    </div>
  )
}
