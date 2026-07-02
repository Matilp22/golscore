import Image from 'next/image'

type BrandMarkProps = {
  compact?: boolean
  hero?: boolean
  className?: string
}

const HF_LOGO_SRC = '/brand/hf-logo.png'

export default function BrandMark({
  compact = false,
  hero = false,
  className = '',
}: BrandMarkProps) {
  const logoClassName = hero
    ? 'h-auto w-[132px] sm:w-[162px]'
    : compact
      ? 'h-auto w-[92px]'
      : 'h-auto w-[118px]'

  return (
    <span className={`hf-brand-logo inline-flex min-w-0 items-center justify-center ${className}`}>
      <Image
        src={HF_LOGO_SRC}
        alt="Hay Fulbo"
        width={134}
        height={91}
        priority={hero}
        className={logoClassName}
      />
    </span>
  )
}
