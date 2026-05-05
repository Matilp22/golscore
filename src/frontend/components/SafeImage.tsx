'use client'

import Image, { type ImageProps } from 'next/image'
import { useState } from 'react'

type SafeImageType = 'team' | 'league' | 'player' | 'venue' | 'broadcast'

type SafeImageProps = Omit<ImageProps, 'src' | 'alt'> & {
  src?: string | null
  alt: string
  imageType: SafeImageType
  fallbackClassName?: string
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
  if (imageType === 'venue') return <VenueFallback className={className} />

  return <TeamFallback className={className} />
}

export default function SafeImage({
  src,
  alt,
  imageType,
  fallbackClassName,
  onError,
  ...props
}: SafeImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = Boolean(src && failedSrc === src)

  if (!src || failed) {
    return <Fallback imageType={imageType} className={fallbackClassName ?? props.className} />
  }

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      onError={(event) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[image-error]', { type: imageType, name: alt, url: src })
        }

        setFailedSrc(src)
        onError?.(event)
      }}
    />
  )
}
