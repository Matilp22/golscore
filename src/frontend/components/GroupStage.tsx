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
    <div className="inline-flex shrink-0 rounded-lg border border-white/8 bg-[#0c1115] p-0.5 sm:rounded-xl sm:p-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`min-h-7 rounded-md px-2 text-[11px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ff0b2]/70 sm:min-h-8 sm:rounded-lg sm:px-3 sm:text-xs ${
              isActive
                ? 'bg-[#7ff0b2] text-[#07100b] shadow-[0_0_18px_rgba(127,240,178,0.18)]'
                : 'text-[#9eacb8] hover:bg-white/[0.05] hover:text-white'
            }`}
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
  title,
  table,
  fixtures,
  defaultTab = 'table',
}: {
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
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/8 bg-[#0f1317]/92">
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-white/6 bg-[#13181d] px-2 py-1.5 md:px-3 md:py-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-white md:text-base md:font-bold">{title}</h2>
        </div>
        {hasFixtures ? <GroupTabs activeTab={activeTab} onChange={setActiveTab} /> : null}
      </div>

      <div className="p-2 md:p-2.5">
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
    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
      {groups.map((group) => (
        <GroupStageCard
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
