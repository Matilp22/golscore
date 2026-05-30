'use client'

import Link from 'next/link'
import type { MouseEvent, ReactNode } from 'react'

import { useChampionsEntrySound } from '@/frontend/hooks/useChampionsEntrySound'

type ChampionsEntrySoundLinkProps = {
  href: string
  tournamentKey?: string
  className?: string
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}

function isPlainNavigationClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    event.currentTarget.target !== '_blank'
  )
}

export default function ChampionsEntrySoundLink({
  href,
  tournamentKey,
  className,
  children,
  onClick,
}: ChampionsEntrySoundLinkProps) {
  const { play } = useChampionsEntrySound()
  const isChampions = tournamentKey === 'internacional-champions'

  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        onClick?.(event)

        if (!event.defaultPrevented && isChampions && isPlainNavigationClick(event)) {
          void play()
        }
      }}
    >
      {children}
    </Link>
  )
}
