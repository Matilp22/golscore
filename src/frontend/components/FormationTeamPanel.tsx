'use client'

import { useState } from 'react'
import { formatEventMinute } from '@/shared/utils/event-minute'

type TeamStyle = {
  shirt: string
  text: string
  border: string
}

type PanelPlayer = {
  id: string
  name: string
  number?: number
  style: TeamStyle
  isCaptain?: boolean
  goals?: number
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
  starters: PanelPlayer[]
  substitutes: PanelPlayer[]
  align: 'left' | 'right'
}

function Shirt({
  number,
  style,
}: {
  number?: number | string
  style: TeamStyle
}) {
  return (
    <div
      className="flex h-8 w-7 items-center justify-center border-2 text-[10px] font-black shadow-md"
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

function CaptainBadge() {
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-[#f3d36c] bg-[#5b4a16] px-1 text-[9px] font-black uppercase tracking-[0.04em] text-[#ffe38a] shadow-[0_0_0_1px_rgba(0,0,0,0.28)]">
      C
    </span>
  )
}

function TinyEventBadges({
  goals = 0,
  yellowCards = 0,
  redCards = 0,
}: {
  goals?: number
  yellowCards?: number
  redCards?: number
}) {
  if (!goals && !yellowCards && !redCards) return null

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
      {yellowCards ? (
        <span className="inline-block h-[13px] w-[9px] rounded-[2px] bg-[#f3d36c]" />
      ) : null}
      {redCards ? (
        <span className="inline-block h-[13px] w-[9px] rounded-[2px] bg-[#ef4444]" />
      ) : null}
    </div>
  )
}

export default function FormationTeamPanel({
  title,
  coachName,
  starters,
  substitutes,
  align,
}: FormationTeamPanelProps) {
  const [tab, setTab] = useState<'starters' | 'substitutes'>('starters')
  const players = tab === 'starters' ? starters : substitutes

  return (
    <div className="w-full rounded-2xl border border-white/8 bg-[#111418] p-2 sm:p-3 md:p-4">
      <div className={`${align === 'right' ? 'text-right' : 'text-left'}`}>
        <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-[#f3f6fa]">{title}</h4>
      </div>

      <div className={`mt-3 flex gap-2 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <button
          type="button"
          onClick={() => setTab('starters')}
          className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
            tab === 'starters'
              ? 'border-[#25553d] bg-[#163828] text-[#7ff0b2]'
              : 'border-white/8 bg-[#161a20] text-[#a8b0bc] hover:bg-[#1b2128]'
          }`}
        >
          Titulares
        </button>
        <button
          type="button"
          onClick={() => setTab('substitutes')}
          className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
            tab === 'substitutes'
              ? 'border-[#25553d] bg-[#163828] text-[#7ff0b2]'
              : 'border-white/8 bg-[#161a20] text-[#a8b0bc] hover:bg-[#1b2128]'
          }`}
        >
          Suplentes
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-white/6 bg-[#161a20] px-2 py-3 md:mt-4 md:px-3">
        <p className="text-[11px] uppercase tracking-wide text-[#8d98a7]">DT</p>
        <p className="mt-1 text-sm font-semibold text-white">
          {coachName || 'No disponible'}
        </p>
      </div>

      <div className="mt-3 space-y-2 md:mt-4">
        {players.length ? (
          players.map((player) => (
            <div
              key={player.id}
              className={`flex items-center gap-2 rounded-xl border border-white/6 bg-[#161a20] px-2 py-2 md:gap-3 md:px-3 ${
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

              <div className={`min-w-0 flex-1 ${align === 'right' ? 'text-right' : 'text-left'}`}>
                <p className="truncate text-sm font-semibold text-white">
                  {player.name}
                </p>
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
                      {player.substitutionMinute
                        ? formatEventMinute(player.substitutionMinute, player.substitutionExtraMinute)
                        : ''}
                    </p>
                    <p className="truncate text-[10px] text-[#9fb0c2]">
                      {player.substitutionLabel} {player.replacedPlayerName}
                    </p>
                  </div>
                ) : null}
              </div>

              <TinyEventBadges
                goals={player.goals}
                yellowCards={player.yellowCards}
                redCards={player.redCards}
              />
            </div>
          ))
        ) : (
          <p className="text-sm text-[#8d98a7]">No hay jugadores disponibles.</p>
        )}
      </div>
    </div>
  )
}
