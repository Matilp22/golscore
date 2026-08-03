'use client'

import { useState, type ReactNode } from 'react'

type CompetitionGroupSwitcherItem = {
  id: string
  label: string
  content: ReactNode
}

export default function CompetitionGroupSwitcher({
  groups,
}: {
  groups: CompetitionGroupSwitcherItem[]
}) {
  const [activeId, setActiveId] = useState(groups[0]?.id ?? '')
  const activeGroup = groups.find((group) => group.id === activeId) ?? groups[0]

  if (!activeGroup) return null

  return (
    <section className="hf-competition-group-switcher">
      <header>
        <div>
          <p className="hf-type-overline">Clasificación</p>
          <h2>Tablas de grupos</h2>
        </div>
        <div className="hf-competition-group-tabs" role="tablist" aria-label="Elegir grupo">
          {groups.map((group) => {
            const isActive = group.id === activeGroup.id

            return (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`competition-group-panel-${group.id}`}
                id={`competition-group-tab-${group.id}`}
                className={isActive ? 'is-active' : ''}
                onClick={() => setActiveId(group.id)}
              >
                {group.label}
              </button>
            )
          })}
        </div>
      </header>

      <div
        id={`competition-group-panel-${activeGroup.id}`}
        role="tabpanel"
        aria-labelledby={`competition-group-tab-${activeGroup.id}`}
        className="hf-competition-group-panel"
      >
        {activeGroup.content}
      </div>
    </section>
  )
}
