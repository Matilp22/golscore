type BrandMarkProps = {
  compact?: boolean
  hero?: boolean
  className?: string
}

export default function BrandMark({
  compact = false,
  hero = false,
  className = '',
}: BrandMarkProps) {
  return (
    <span
      className={`hf-brand-logo hf-home-wordmark inline-flex min-w-0 items-center ${hero ? 'is-hero' : ''} ${compact ? 'is-compact' : ''} ${className}`}
      aria-label="Hay Fulbo"
    >
      HAY FULBO<span aria-hidden="true">.</span>
    </span>
  )
}
