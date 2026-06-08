'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  LOCALE_COOKIE_NAME,
  SUPPORTED_LOCALES,
  t,
  type AppLocale,
} from '@/shared/i18n/locales'

type LanguageSelectorProps = {
  locale: AppLocale
  compact?: boolean
}

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function getOptionLabel(currentLocale: AppLocale, optionLocale: AppLocale) {
  if (optionLocale === 'es') return t(currentLocale, 'language.es')
  if (optionLocale === 'en') return t(currentLocale, 'language.en')
  if (optionLocale === 'pt') return t(currentLocale, 'language.pt')

  return t(currentLocale, 'language.fr')
}

export default function LanguageSelector({
  locale,
  compact = false,
}: LanguageSelectorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleChange(nextLocale: AppLocale) {
    if (nextLocale === locale) return

    document.cookie = [
      `${LOCALE_COOKIE_NAME}=${nextLocale}`,
      'path=/',
      `max-age=${COOKIE_MAX_AGE_SECONDS}`,
      'samesite=lax',
    ].join('; ')

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <label className="inline-flex min-w-0 items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.035] px-2 py-1.5 text-xs font-bold text-[#dce7e2] shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
      <span className={compact ? 'sr-only' : 'hidden sm:inline'}>
        {t(locale, 'language.label')}
      </span>
      <select
        value={locale}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value as AppLocale)}
        aria-label={t(locale, 'language.label')}
        className="min-w-0 bg-transparent text-xs font-black uppercase text-white outline-none disabled:cursor-wait disabled:opacity-70"
      >
        {SUPPORTED_LOCALES.map((option) => (
          <option key={option} value={option} className="bg-[#07100d] text-white">
            {compact ? option.toUpperCase() : getOptionLabel(locale, option)}
          </option>
        ))}
      </select>
    </label>
  )
}
