'use client'

import { useTranslations } from '@/frontend/components/LocaleProvider'
import type { MatchSummarySource } from '@/shared/utils/match-summary'

type MatchSummaryPlayerProps = {
  source: MatchSummarySource | null
  isLoading?: boolean
  error?: unknown
}

export default function MatchSummaryPlayer({
  source,
  isLoading = false,
  error,
}: MatchSummaryPlayerProps) {
  const { t } = useTranslations()

  if (isLoading) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-[#10151a]">
        <div className="hf-skeleton h-full w-full" />
      </div>
    )
  }

  if (error || !source) {
    return (
      <div
        className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#13181d] px-4 py-5 text-center"
        data-match-summary-state={error ? 'error' : 'empty'}
      >
        <p className="text-sm font-bold text-white">{t('match.summaryUnavailable')}</p>
        <p className="mt-1 max-w-[260px] text-xs leading-relaxed text-[#8d98a7]">
          {t('match.summaryWillAppear')}
        </p>
      </div>
    )
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0f12]"
      data-match-summary-provider={source.provider}
      data-match-summary-type={source.type}
    >
      <div className="aspect-video w-full overflow-hidden bg-black">
        {source.type === 'iframe' ? (
          <iframe
            title={source.title || t('match.summaryTitle')}
            src={source.src}
            className="h-full w-full border-0"
            loading="lazy"
            allow="encrypted-media; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <video
            src={source.src}
            className="h-full w-full bg-black"
            controls
            playsInline
            preload="metadata"
            aria-label={source.title || t('match.summaryTitle')}
          />
        )}
      </div>

      {source.title ? (
        <p className="line-clamp-2 border-t border-white/8 px-3 py-2 text-xs font-bold leading-snug text-[#d7dee8]">
          {source.title}
        </p>
      ) : null}
    </div>
  )
}
