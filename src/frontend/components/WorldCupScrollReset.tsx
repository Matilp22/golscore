'use client'

import { useEffect } from 'react'

const WORLD_CUP_PATHNAME = '/liga/selecciones-mundial'

export default function WorldCupScrollReset() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const previousScrollRestoration = window.history.scrollRestoration
    let frame: number | null = null

    const resetScroll = () => {
      if (window.location.pathname !== WORLD_CUP_PATHNAME) return

      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }

      frame = window.requestAnimationFrame(() => {
        const targetId = window.location.hash.slice(1)
        const target = targetId ? document.getElementById(targetId) : null

        if (target) {
          target.scrollIntoView({ block: 'start', behavior: 'auto' })
        } else {
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
        }

        frame = null
      })
    }

    window.history.scrollRestoration = 'manual'
    resetScroll()
    window.addEventListener('pageshow', resetScroll)
    window.addEventListener('popstate', resetScroll)

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }

      window.removeEventListener('pageshow', resetScroll)
      window.removeEventListener('popstate', resetScroll)
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

  return null
}
