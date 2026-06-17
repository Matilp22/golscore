'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

import TournamentBackgroundAudio, {
  stopAllTournamentAudio,
} from '@/frontend/components/TournamentBackgroundAudio'
import { CHAMPIONS_AUDIO, WORLD_CUP_AUDIO } from '@/lib/audio-config'

type TournamentAudioKey = 'champions' | 'world-cup'

const CHAMPIONS_PATH = '/liga/internacional-champions'
const WORLD_CUP_PATH = '/liga/selecciones-mundial'

function normalizePathname(pathname: string) {
  if (!pathname || pathname === '/') return '/'

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

function getTournamentAudioKey(pathname: string): TournamentAudioKey | null {
  const normalizedPathname = normalizePathname(pathname)

  if (normalizedPathname === CHAMPIONS_PATH) return 'champions'
  if (normalizedPathname === WORLD_CUP_PATH) return 'world-cup'

  return null
}

function getAnchorPathname(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute('href')
  if (!href || href.startsWith('#')) return null
  if (anchor.target && anchor.target !== '_self') return null

  try {
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return null

    return url.pathname
  } catch {
    return null
  }
}

export default function TournamentAudioController() {
  const pathname = usePathname() ?? '/'
  const activeAudioKey = getTournamentAudioKey(pathname)

  useEffect(() => {
    const currentAudioKey = getTournamentAudioKey(pathname)

    function stopIfLeavingCurrentAudioSection(event: Event) {
      if (!currentAudioKey) return
      if (!(event.target instanceof Element)) return

      const anchor = event.target.closest<HTMLAnchorElement>('a[href]')
      if (!anchor) return

      const nextPathname = getAnchorPathname(anchor)
      if (!nextPathname) return

      const nextAudioKey = getTournamentAudioKey(nextPathname)
      if (nextAudioKey !== currentAudioKey) {
        stopAllTournamentAudio()
      }
    }

    document.addEventListener('pointerdown', stopIfLeavingCurrentAudioSection, {
      capture: true,
      passive: true,
    })
    document.addEventListener('click', stopIfLeavingCurrentAudioSection, true)

    return () => {
      document.removeEventListener('pointerdown', stopIfLeavingCurrentAudioSection, true)
      document.removeEventListener('click', stopIfLeavingCurrentAudioSection, true)
    }
  }, [pathname])

  return (
    <>
      <TournamentBackgroundAudio
        enabled={activeAudioKey === 'champions' && CHAMPIONS_AUDIO.enabled}
        src={CHAMPIONS_AUDIO.src}
        volume={CHAMPIONS_AUDIO.volume}
        loop
        debugName="champions-section-audio"
      />
      <TournamentBackgroundAudio
        enabled={activeAudioKey === 'world-cup' && WORLD_CUP_AUDIO.enabled}
        src={WORLD_CUP_AUDIO.src}
        volume={WORLD_CUP_AUDIO.volume}
        loop={WORLD_CUP_AUDIO.loop}
        debugName="world-cup-section-audio"
      />
    </>
  )
}
