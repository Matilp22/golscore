'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

function shouldKeepBrowserScroll() {
  return Boolean(window.location.hash)
}

function scrollToPageTop() {
  window.requestAnimationFrame(() => {
    if (shouldKeepBrowserScroll()) return

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  })
}

export default function PageScrollRestoration() {
  const pathname = usePathname()
  const lastPathname = useRef<string | null>(null)

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration

    window.history.scrollRestoration = 'manual'

    const handleNavigationRestore = () => {
      scrollToPageTop()
    }

    window.addEventListener('pageshow', handleNavigationRestore)
    window.addEventListener('popstate', handleNavigationRestore)

    return () => {
      window.removeEventListener('pageshow', handleNavigationRestore)
      window.removeEventListener('popstate', handleNavigationRestore)
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

  useEffect(() => {
    if (!pathname) return

    if (lastPathname.current === pathname) return

    lastPathname.current = pathname
    scrollToPageTop()
  }, [pathname])

  return null
}
