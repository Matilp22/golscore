import { cookies } from 'next/headers'

import {
  LOCALE_COOKIE_NAME,
  resolveAppLocale,
} from '@/shared/i18n/locales'

export async function getRequestLocale() {
  const cookieStore = await cookies()

  return resolveAppLocale({
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value ?? null,
  })
}
