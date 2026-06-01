'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

type GtagCommand =
  | ['config', string, Record<string, string>]
  | ['js', Date]
  | ['event', string, Record<string, string | number | boolean | undefined>]

declare global {
  interface Window {
    dataLayer?: GtagCommand[]
    gtag?: (...args: GtagCommand) => void
  }
}

type GoogleAnalyticsPageViewProps = {
  measurementId: string
}

export default function GoogleAnalyticsPageView({
  measurementId,
}: GoogleAnalyticsPageViewProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hasMounted = useRef(false)

  useEffect(() => {
    if (!pathname) {
      return
    }

    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }

    const queryString = searchParams.toString()
    const pagePath = queryString ? `${pathname}?${queryString}` : pathname

    const gtag =
      window.gtag ??
      ((...args: GtagCommand) => {
        window.dataLayer = window.dataLayer ?? []
        window.dataLayer.push(args)
      })

    gtag('config', measurementId, {
      page_location: window.location.href,
      page_path: pagePath,
      page_title: document.title,
    })
  }, [measurementId, pathname, searchParams])

  return null
}
