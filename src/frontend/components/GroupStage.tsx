'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'

import { useTranslations } from '@/frontend/components/LocaleProvider'

export type GroupStageTab = 'table' | 'fixtures'

export type GroupStageGridItem = {
  id: string
  title: string
  table: ReactNode
  fixtures?: ReactNode | null
}

type GroupTabsProps = {
  activeTab: GroupStageTab
  onChange: (tab: GroupStageTab) => void
}

export function GroupTabs({ activeTab, onChange }: GroupTabsProps) {
  const { t } = useTranslations()
  const tabs: Array<{ key: GroupStageTab; label: string }> = [
    { key: 'table', label: t('stage.table') },
    { key: 'fixtures', label: t('stage.fixtures') },
  ]

  return (
    <div className="hf-group-tabs" role="group" aria-label="Vista del grupo">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={isActive ? 'is-active' : ''}
            aria-pressed={isActive}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function GroupStageCard({
  id,
  title,
  table,
  fixtures,
  defaultTab = 'table',
}: {
  id?: string
  title: string
  table: ReactNode
  fixtures?: ReactNode | null
  defaultTab?: GroupStageTab
}) {
  const hasFixtures = Boolean(fixtures)
  const [activeTab, setActiveTab] = useState<GroupStageTab>(
    hasFixtures ? defaultTab : 'table'
  )
  const visibleTab = hasFixtures ? activeTab : 'table'

  return (
    <section id={id} className="hf-group-card">
      <header className="hf-group-card-heading">
        <div>
          <h2>{title}</h2>
        </div>
        {hasFixtures ? <GroupTabs activeTab={activeTab} onChange={setActiveTab} /> : null}
      </header>

      <div className="hf-group-card-body">
        {visibleTab === 'table' ? table : fixtures}
      </div>
    </section>
  )
}

export default function GroupStageGrid({
  groups,
  defaultTab = 'table',
}: {
  groups: GroupStageGridItem[]
  defaultTab?: GroupStageTab
}) {
  return (
    <div className="hf-group-grid">
      {groups.map((group) => (
        <GroupStageCard
          id={group.id}
          key={group.id}
          title={group.title}
          table={group.table}
          fixtures={group.fixtures}
          defaultTab={defaultTab}
        />
      ))}
    </div>
  )
}
