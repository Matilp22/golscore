'use client'

import { useMemo, useState } from 'react'

import HomeMatchSection from '@/frontend/components/home/matchday/HomeMatchSection'

import type { HomeMatchEntry } from '@/frontend/components/home/matchday/types'
import type { AppLocale } from '@/shared/i18n/locales'

type BoardTab = 'live' | 'scheduled' | 'finished' | 'special'

type HomeMatchBoardProps = {
  locale: AppLocale
  live: HomeMatchEntry[]
  scheduled: HomeMatchEntry[]
  finished: HomeMatchEntry[]
  special: HomeMatchEntry[]
}

export default function HomeMatchBoard({
  locale,
  live,
  scheduled,
  finished,
  special,
}: HomeMatchBoardProps) {
  const tabs = useMemo(
    () => [
      {
        key: 'live' as const,
        label: 'En vivo',
        entries: live,
        tone: 'live' as const,
        empty: 'No hay partidos en juego en este momento.',
      },
      {
        key: 'scheduled' as const,
        label: 'Próximos',
        entries: scheduled,
        tone: 'scheduled' as const,
        empty: 'No quedan partidos programados para esta fecha.',
      },
      {
        key: 'finished' as const,
        label: 'Finalizados',
        entries: finished,
        tone: 'finished' as const,
        empty: 'Todavía no hay resultados finales en esta jornada.',
      },
      ...(special.length
        ? [
            {
              key: 'special' as const,
              label: 'Otros',
              entries: special,
              tone: 'special' as const,
              empty: 'No hay partidos con estados especiales.',
            },
          ]
        : []),
    ],
    [finished, live, scheduled, special]
  )
  const initialTab =
    tabs.find((tab) => tab.entries.length > 0)?.key ?? ('live' as const)
  const [activeTab, setActiveTab] = useState<BoardTab>(initialTab)
  const selected = tabs.find((tab) => tab.key === activeTab) ?? tabs[0]

  return (
    <section className="hf-home-scoreboard" aria-labelledby="partidos">
      <header className="hf-home-scoreboard-heading">
        <div>
          <span className="hf-type-overline">Agenda completa</span>
          <h2 id="partidos">Partidos de hoy</h2>
        </div>
        <span className="hf-home-scoreboard-total">
          {live.length + scheduled.length + finished.length + special.length}
          <small>partidos</small>
        </span>
      </header>

      <div
        className="hf-home-scoreboard-tabs"
        role="tablist"
        aria-label="Estado de los partidos"
      >
        {tabs.map((tab) => {
          const active = tab.key === selected.key

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`home-board-${tab.key}`}
              className={active ? 'is-active' : ''}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.label}</span>
              <strong>{tab.entries.length}</strong>
            </button>
          )
        })}
      </div>

      <div
        id={`home-board-${selected.key}`}
        role="tabpanel"
        className="hf-home-scoreboard-panel"
      >
        <HomeMatchSection
          id={`home-board-section-${selected.key}`}
          eyebrow=""
          title={selected.label}
          description=""
          entries={selected.entries}
          locale={locale}
          tone={selected.tone}
          emptyMessage={selected.empty}
          showHeading={false}
          labelledBy="partidos"
        />
      </div>
    </section>
  )
}
