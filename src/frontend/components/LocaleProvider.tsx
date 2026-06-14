'use client'

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'

import { DEFAULT_LOCALE, t, type AppLocale, type MessageKey } from '@/shared/i18n/locales'

const LocaleContext = createContext<AppLocale>(DEFAULT_LOCALE)

export function LocaleProvider({
  children,
  locale,
}: {
  children: ReactNode
  locale: AppLocale
}) {
  return (
    <LocaleContext.Provider value={locale}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}

export function useTranslations() {
  const locale = useLocale()
  const translate = useCallback(
    (key: MessageKey, values?: Record<string, string>) => t(locale, key, values),
    [locale]
  )

  return useMemo(() => ({ locale, t: translate }), [locale, translate])
}
