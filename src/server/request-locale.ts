import { cookies, headers } from 'next/headers'

import {
  LOCALE_COOKIE_NAME,
  resolveAppLocale,
} from '@/shared/i18n/locales'

export async function getRequestLocale() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])

  return resolveAppLocale({
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value ?? null,
    country:
      headerStore.get('x-vercel-ip-country') ??
      headerStore.get('cf-ipcountry') ??
      null,
    acceptLanguage: headerStore.get('accept-language'),
  })
}
