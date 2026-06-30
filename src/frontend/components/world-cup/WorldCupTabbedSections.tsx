'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

type WorldCupPanelId =
  | 'fase-eliminatoria'
  | 'fase-de-grupos'
  | 'estadisticas'
  | 'selecciones'
  | 'sedes'
  | 'historia'

type WorldCupTabbedSectionsProps = {
  defaultPanel: WorldCupPanelId
  bracketContent?: ReactNode
  groupStageContent?: ReactNode
  statsContent?: ReactNode
  selectionsContent: ReactNode
  venuesContent: ReactNode
  historyContent: ReactNode
}

const panelIds: WorldCupPanelId[] = [
  'fase-eliminatoria',
  'fase-de-grupos',
  'estadisticas',
  'selecciones',
  'sedes',
  'historia',
]

function getPanelFromHash(hash: string, fallback: WorldCupPanelId): WorldCupPanelId {
  const target = hash.replace(/^#/, '')

  if (target.startsWith('group-')) return 'fase-de-grupos'
  if (panelIds.includes(target as WorldCupPanelId)) return target as WorldCupPanelId

  return fallback
}

export default function WorldCupTabbedSections({
  defaultPanel,
  bracketContent,
  groupStageContent,
  statsContent,
  selectionsContent,
  venuesContent,
  historyContent,
}: WorldCupTabbedSectionsProps) {
  const [activePanel, setActivePanel] = useState<WorldCupPanelId>(defaultPanel)
  const panels = useMemo(
    () => ({
      'fase-eliminatoria': bracketContent,
      'fase-de-grupos': groupStageContent,
      estadisticas: statsContent,
      selecciones: selectionsContent,
      sedes: venuesContent,
      historia: historyContent,
    }),
    [
      bracketContent,
      groupStageContent,
      historyContent,
      selectionsContent,
      statsContent,
      venuesContent,
    ]
  )

  useEffect(() => {
    const syncFromHash = () => {
      setActivePanel(getPanelFromHash(window.location.hash, defaultPanel))
    }

    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)

    return () => {
      window.removeEventListener('hashchange', syncFromHash)
    }
  }, [defaultPanel])

  useEffect(() => {
    const hashTarget = window.location.hash.replace(/^#/, '')
    const targetId = hashTarget || activePanel

    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: 'start', behavior: 'auto' })
    })
  }, [activePanel])

  const content = panels[activePanel] ?? panels[defaultPanel]

  return (
    <div className="hf-world-tab-panels mt-5">
      <section id={activePanel} className="hf-world-tab-panel is-active min-w-0 scroll-mt-28">
        {content}
      </section>
    </div>
  )
}
