'use client'

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
  function handleChange(nextLocale: AppLocale) {
    if (nextLocale === locale) return

    document.cookie = [
      `${LOCALE_COOKIE_NAME}=${nextLocale}`,
      'path=/',
      `max-age=${COOKIE_MAX_AGE_SECONDS}`,
      'samesite=lax',
    ].join('; ')

    window.location.reload()
  }

  return (
    <label className="hf-language-selector">
      <span className={compact ? 'sr-only' : 'hidden sm:inline'}>
        {t(locale, 'language.label')}
      </span>
      <select
        value={locale}
        onChange={(event) => handleChange(event.target.value as AppLocale)}
        aria-label={t(locale, 'language.label')}
        className="hf-language-selector-control"
      >
        {SUPPORTED_LOCALES.map((option) => (
          <option key={option} value={option}>
            {compact ? option.toUpperCase() : getOptionLabel(locale, option)}
          </option>
        ))}
      </select>
    </label>
  )
}
