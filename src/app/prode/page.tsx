import Link from 'next/link'

import BrandMark from '@/frontend/components/BrandMark'
import ProdePanel from '@/frontend/components/prode/ProdePanel'
import { getRequestLocale } from '@/server/request-locale'
import { t } from '@/shared/i18n/locales'
import { buildSeoMetadata } from '@/shared/seo'

export async function generateMetadata() {
  const locale = await getRequestLocale()

  return buildSeoMetadata({
    title:
      locale === 'es'
        ? 'Prode Hay Fulbo | Pronósticos de Fútbol y Ranking | Hay Fulbo'
        : `${t(locale, 'prode.title')} Hay Fulbo | Hay Fulbo`,
    description:
      locale === 'es'
        ? 'Jugá al Prode de Hay Fulbo, pronosticá resultados de fútbol, sumá puntos y competí en rankings con amigos y torneos privados.'
        : t(locale, 'prode.subtitle'),
    path: '/prode',
  })
}

export default async function ProdePage() {
  const locale = await getRequestLocale()

  return (
    <div className="min-h-screen overflow-x-hidden text-white">
      <div className="w-full px-2 py-3 md:mx-auto md:max-w-6xl md:px-4 md:py-6">
        <div className="hf-hero mb-3 w-full overflow-hidden rounded-3xl px-3 py-3 sm:px-4 md:mb-4 md:px-5 md:py-4">
          <div className="relative z-10 flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
                <BrandMark compact />
                <h1 className="text-2xl font-black sm:text-3xl">{t(locale, 'prode.title')}</h1>
              </div>
              <p className="mt-2 text-sm text-[#b8c8c2]">
                {t(locale, 'prode.subtitle')}
              </p>
            </div>
            <Link
              href="/prode/torneos"
              className="hf-button inline-flex h-10 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-black sm:px-5"
            >
              {t(locale, 'prode.tournaments')}
            </Link>
          </div>
        </div>

        <ProdePanel />
      </div>
    </div>
  )
}
