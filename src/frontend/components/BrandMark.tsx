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
  const markSize = hero
    ? 'h-16 w-16 text-[1.45rem] sm:h-20 sm:w-20 sm:text-[1.8rem]'
    : 'h-10 w-10 text-[1rem] sm:h-11 sm:w-11 sm:text-[1.08rem]'
  const wordSize = hero
    ? 'text-[2.35rem] leading-none sm:text-5xl md:text-7xl'
    : 'text-lg leading-none sm:text-xl'

  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
      <span className={`hf-brand-mark shrink-0 rounded-2xl font-black ${markSize}`}>
        <span className="relative z-10">HF</span>
        <span className="absolute -right-3 top-2 h-1 w-10 -rotate-12 rounded-full bg-[#70ff9d]/70" />
        <span className="absolute -right-1 bottom-3 h-1 w-7 -rotate-12 rounded-full bg-white/35" />
      </span>
      {compact ? null : (
        <span className={`hf-brand-word min-w-0 font-black text-white ${wordSize}`}>
          HAY FULBO
        </span>
      )}
    </span>
  )
}
