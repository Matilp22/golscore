'use client'

import { type CSSProperties, type ImgHTMLAttributes, useEffect, useState } from 'react'
import {
  getAssetHostname,
  isAllowedRemoteAssetHost,
} from '@/shared/utils/asset-urls'

type SafeImageType = 'team' | 'league' | 'player' | 'venue' | 'broadcast' | 'video'

type SafeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'height' | 'width'> & {
  src?: string | null
  alt: string
  imageType: SafeImageType
  width?: number | string
  height?: number | string
  fill?: boolean
  priority?: boolean
  sizes?: string
  unoptimized?: boolean
  fallbackClassName?: string
  assetId?: string | number | null
  expectedSrc?: string | null
  receivedProps?: Record<string, unknown>
}

function TeamFallback({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block bg-[#7f8a98] ${className}`}
      style={{ clipPath: 'polygon(50% 0, 92% 16%, 84% 72%, 50% 100%, 16% 72%, 8% 16%)' }}
    />
  )
}

function LeagueFallback({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex items-center justify-center ${className}`}
    >
      <span className="absolute bottom-[10%] h-[14%] w-[58%] rounded-sm bg-[#7f8a98]" />
      <span className="absolute bottom-[22%] h-[36%] w-[42%] rounded-b-md rounded-t-sm border-[2px] border-[#7f8a98]" />
      <span className="absolute top-[12%] h-[22%] w-[24%] rounded-t-full border-[2px] border-b-0 border-[#7f8a98]" />
    </span>
  )
}

function PlayerFallback({ className = '' }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center overflow-hidden bg-[#20262e] ${className}`}>
      <span className="absolute top-[18%] h-[28%] w-[28%] rounded-full bg-[#7f8a98]" />
      <span className="absolute bottom-[12%] h-[36%] w-[58%] rounded-t-full bg-[#7f8a98]" />
    </span>
  )
}

function VenueFallback({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center bg-[#141a20] text-xs text-[#7f8a98] ${className}`}>
      Sin imagen
    </span>
  )
}

function Fallback({
  imageType,
  className,
}: {
  imageType: SafeImageType
  className?: string
}) {
  if (imageType === 'player') return <PlayerFallback className={className} />
  if (imageType === 'league') return <LeagueFallback className={className} />
  if (imageType === 'venue' || imageType === 'video') {
    return <VenueFallback className={className} />
  }

  return <TeamFallback className={className} />
}

export default function SafeImage({
  src,
  alt,
  imageType,
  fill,
  priority,
  sizes,
  unoptimized,
  style,
  fallbackClassName,
  assetId,
  expectedSrc,
  receivedProps,
  onError,
  ...props
}: SafeImageProps) {
  void unoptimized

  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = Boolean(src && failedSrc === src)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (src && !failed) return

    console.warn('[asset-render-fallback]', {
      type: imageType,
      name: alt,
      src: src ?? null,
      id: assetId ?? null,
      expectedLogoUrl: expectedSrc ?? null,
      props: receivedProps ?? null,
      host: getAssetHostname(src),
      blockedDomain: src ? !isAllowedRemoteAssetHost(src) : false,
      reason: src ? 'load-error' : 'missing-src',
    })
  }, [alt, assetId, expectedSrc, failed, imageType, receivedProps, src])

  if (!src || failed) {
    return <Fallback imageType={imageType} className={fallbackClassName ?? props.className} />
  }

  const fillStyle: CSSProperties | undefined = fill
    ? {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        ...style,
      }
    : style

  return (
    // Escudos y fotos ya vienen normalizados desde Supabase. Usar img nativo evita
    // falsos placeholders por el optimizer de Next o por caches de /_next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      src={src}
      alt={alt}
      style={fillStyle}
      sizes={sizes}
      loading={priority ? 'eager' : props.loading ?? 'lazy'}
      decoding={props.decoding ?? 'async'}
      onError={(event) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[image-error]', {
            type: imageType,
            name: alt,
            src,
            id: assetId ?? null,
            expectedLogoUrl: expectedSrc ?? null,
            props: receivedProps ?? null,
            host: getAssetHostname(src),
            blockedDomain: !isAllowedRemoteAssetHost(src),
          })
        }

        setFailedSrc(src)
        onError?.(event)
      }}
    />
  )
}
