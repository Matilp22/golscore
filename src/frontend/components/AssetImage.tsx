'use client'

import SafeImage from '@/frontend/components/SafeImage'

type AssetImageProps = {
  src?: string | null
  alt: string
  size?: number
  className?: string
  fallbackClassName?: string
  priority?: boolean
  unoptimized?: boolean
}

export function TeamLogo({
  src,
  alt,
  size = 24,
  className,
  fallbackClassName,
  priority,
  unoptimized,
}: AssetImageProps) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden"
      style={{ width: size, height: size }}
    >
      <SafeImage
        src={src}
        alt={alt}
        imageType="team"
        width={size}
        height={size}
        className={className ?? 'h-full w-full object-contain'}
        fallbackClassName={fallbackClassName ?? 'h-[80%] w-[68%]'}
        priority={priority}
        unoptimized={unoptimized}
      />
    </span>
  )
}

export function LeagueLogo({
  src,
  alt,
  size = 24,
  className,
  fallbackClassName,
  priority,
  unoptimized,
}: AssetImageProps) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden"
      style={{ width: size, height: size }}
    >
      <SafeImage
        src={src}
        alt={alt}
        imageType="league"
        width={size}
        height={size}
        className={className ?? 'h-full w-full object-contain'}
        fallbackClassName={fallbackClassName ?? 'h-[80%] w-[68%]'}
        priority={priority}
        unoptimized={unoptimized}
      />
    </span>
  )
}

export function PlayerPhoto({
  src,
  alt,
  size = 40,
  className,
  fallbackClassName,
  priority,
  unoptimized,
}: AssetImageProps) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#20262e]"
      style={{ width: size, height: size }}
    >
      <SafeImage
        src={src}
        alt={alt}
        imageType="player"
        width={size}
        height={size}
        className={className ?? 'h-full w-full rounded-full object-cover'}
        fallbackClassName={fallbackClassName ?? 'h-full w-full rounded-full'}
        priority={priority}
        unoptimized={unoptimized}
      />
    </span>
  )
}
