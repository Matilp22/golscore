import type { ReactNode } from 'react'

import type { SidebarSectionConfig, TournamentPageConfig } from '@/lib/tournament-pages'

export type SidebarNavigationItem = {
  key: string
  label: string
  href: string
  type: 'favorite' | 'editorial' | 'country' | 'account'
  icon?: ReactNode
  accent?: 'news' | 'transfers'
  mobileVisible?: boolean
  desktopVisible?: boolean
}

export type SidebarNavigationGroup = SidebarNavigationItem & {
  tournaments: TournamentPageConfig[]
  section?: SidebarSectionConfig
}

export const HEADER_ACTIONS = [
  {
    key: 'world-cup-simulator',
    label: 'Simulador Mundial',
    href: '/liga/selecciones-mundial#simulador-mundial',
    accent: 'simulator',
  },
  {
    key: 'prode',
    label: 'Prode',
    href: '/prode',
    accent: 'prode',
  },
] as const

function NewsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path
        d="M5 5.5h10.7A2.3 2.3 0 0 1 18 7.8V18H6.8A2.8 2.8 0 0 1 4 15.2V6.5a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M18 9h1.2a.8.8 0 0 1 .8.8v5.7A2.5 2.5 0 0 1 17.5 18M8 9h6M8 12h6M8 15h3.8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function TransfersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path
        d="M7 7h10m0 0-3-3m3 3-3 3M17 17H7m0 0 3 3m-3-3 3-3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M12 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export const EDITORIAL_SIDEBAR_ITEMS: SidebarNavigationItem[] = [
  {
    key: 'news',
    label: 'Noticias',
    href: '/noticias',
    type: 'editorial',
    accent: 'news',
    icon: <NewsIcon />,
    mobileVisible: true,
    desktopVisible: true,
  },
  {
    key: 'transfers',
    label: 'Mercado de pases',
    href: '/mercado-de-pases',
    type: 'editorial',
    accent: 'transfers',
    icon: <TransfersIcon />,
    mobileVisible: true,
    desktopVisible: true,
  },
]

export function getSidebarNavigationItems({
  sections,
  favoriteTournaments,
  favoritesLabel,
}: {
  sections: SidebarSectionConfig[]
  favoriteTournaments: TournamentPageConfig[]
  favoritesLabel: string
}): SidebarNavigationGroup[] {
  return [
    {
      key: 'favorites',
      label: favoritesLabel,
      href: '#favoritos',
      type: 'favorite',
      tournaments: favoriteTournaments,
      mobileVisible: true,
      desktopVisible: true,
    },
    ...EDITORIAL_SIDEBAR_ITEMS.map((item) => ({
      ...item,
      tournaments: [],
    })),
    ...sections.map((section) => ({
      key: section.key,
      label: section.title,
      href: `/seccion/${section.key}`,
      type: 'country' as const,
      tournaments: section.tournaments,
      section,
      mobileVisible: true,
      desktopVisible: true,
    })),
  ]
}
