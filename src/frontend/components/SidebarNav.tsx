'use client'

import Link from 'next/link'
import { useState } from 'react'

import type { SidebarSectionConfig } from '@/lib/tournament-pages'

type SidebarNavProps = {
  sections: SidebarSectionConfig[]
  activeSectionKey?: string
  highlightedTournamentKeys?: string[]
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`h-4 w-4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        open ? 'rotate-180' : ''
      }`}
    >
      <path
        d="M5.5 7.5 10 12l4.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function SidebarNav({
  sections,
  activeSectionKey,
  highlightedTournamentKeys = [],
}: SidebarNavProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.map((section) => [
        section.key,
        section.key === activeSectionKey ||
          section.key === 'argentina' ||
          section.key === 'selecciones',
      ])
    )
  )

  const highlighted = new Set(highlightedTournamentKeys)

  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const isOpen = openSections[section.key] ?? false

        return (
          <div
            key={section.key}
            className="overflow-hidden rounded-2xl border border-white/7 bg-[linear-gradient(180deg,#111418_0%,#0d1115_100%)] shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              <Link
                href={`/seccion/${section.key}`}
                className={`min-w-0 flex-1 rounded-xl px-2 py-1.5 text-sm font-semibold transition ${
                  activeSectionKey === section.key
                    ? 'bg-[#163828] text-[#7ff0b2]'
                    : 'text-[#e4ebf3] hover:bg-white/5'
                }`}
              >
                {section.title}
              </Link>

              <button
                type="button"
                onClick={() =>
                  setOpenSections((current) => ({
                    ...current,
                    [section.key]: !isOpen,
                  }))
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-[#95a1af] transition hover:bg-white/[0.08] hover:text-white"
                aria-label={`Ver torneos de ${section.title}`}
                aria-expanded={isOpen}
              >
                <Chevron open={isOpen} />
              </button>
            </div>

            <div
              className="grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                gridTemplateRows: isOpen ? '1fr' : '0fr',
                opacity: isOpen ? 1 : 0.68,
              }}
            >
              <div className="overflow-hidden">
                <div className="border-t border-white/6 px-2 pb-2 pt-1">
                  <div className="space-y-1.5">
                    {section.tournaments.map((tournament) => {
                      const isHighlighted = highlighted.has(tournament.key)

                      return (
                        <Link
                          key={tournament.key}
                          href={`/liga/${tournament.key}`}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                            isHighlighted
                              ? 'bg-[#152a20] text-[#dfffe9] shadow-[inset_0_0_0_1px_rgba(127,240,178,0.16)] hover:bg-[#193326]'
                              : 'text-[#bcc6d2] hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full transition ${
                              isHighlighted ? 'bg-[#7ff0b2]' : 'bg-[#4e5b68]'
                            }`}
                          />
                          <span className="truncate">{tournament.title}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
