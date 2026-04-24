'use client'

import { useState } from 'react'

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
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-[13px] w-[13px] overflow-visible">
      <circle
        cx="32"
        cy="32"
        r="29"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.4"
      />
      <path
        d="M32 11 23 18.5v11l9 6 9-6v-11L32 11Z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M23 18.5 12 15 6.5 28.5 13.5 36l10-6.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M41 18.5 52 15l5.5 13.5-7 7.5-10-6.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 36 16.5 48.5 27.5 49l4.5-13.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M50.5 36 47.5 48.5 36.5 49 32 35.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M27.5 49 32 58 36.5 49"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
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
        <span className="inline-block h-3.5 w-2.5 rounded-[2px] bg-[#f3d36c]" />
      ) : null}
      {redCards ? (
        <span className="inline-block h-3.5 w-2.5 rounded-[2px] bg-[#ef4444]" />
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
    <div className="rounded-2xl border border-white/8 bg-[#111418] p-4">
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

      <div className="mt-4 rounded-xl border border-white/6 bg-[#161a20] px-3 py-3">
        <p className="text-[11px] uppercase tracking-wide text-[#8d98a7]">DT</p>
        <p className="mt-1 text-sm font-semibold text-white">
          {coachName || 'No disponible'}
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {players.length ? (
          players.map((player) => (
            <div
              key={player.id}
              className={`flex items-center gap-3 rounded-xl border border-white/6 bg-[#161a20] px-3 py-2 ${
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
                  <p className="mt-0.5 truncate text-[10px] text-[#9fb0c2]">
                    {player.substitutionLabel} {player.replacedPlayerName}
                  </p>
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
