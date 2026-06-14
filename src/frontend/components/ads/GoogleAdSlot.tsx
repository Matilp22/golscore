'use client'

import { useEffect, type CSSProperties } from 'react'

import {
  ADSENSE_DISPLAY_SLOT_ID,
  ADSENSE_PUBLISHER_ID,
} from '@/shared/config/adsense'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

type GoogleAdSlotProps = {
  slotId?: string
  className?: string
  format?: string
  fullWidthResponsive?: boolean
  style?: CSSProperties
}

export default function GoogleAdSlot({
  slotId = ADSENSE_DISPLAY_SLOT_ID,
  className = '',
  format = 'auto',
  fullWidthResponsive = true,
  style,
}: GoogleAdSlotProps) {
  const cleanSlotId = slotId?.trim()

  useEffect(() => {
    if (!cleanSlotId || !ADSENSE_PUBLISHER_ID) return

    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
    } catch (error) {
      console.warn('[adsense] No se pudo inicializar el bloque de anuncio.', error)
    }
  }, [cleanSlotId])

  if (!cleanSlotId || !ADSENSE_PUBLISHER_ID) return null

  return (
    <aside
      className={`mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-white/8 bg-black/10 ${className}`}
      aria-label="Publicidad"
    >
      <ins
        className="adsbygoogle block"
        style={{
          display: 'block',
          minHeight: 90,
          ...style,
        }}
        data-ad-client={ADSENSE_PUBLISHER_ID}
        data-ad-slot={cleanSlotId}
        data-ad-format={format}
        data-full-width-responsive={fullWidthResponsive ? 'true' : 'false'}
      />
    </aside>
  )
}
