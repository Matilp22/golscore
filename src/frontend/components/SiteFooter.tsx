import Link from 'next/link'

import BrandMark from '@/frontend/components/BrandMark'
import LanguageSelector from '@/frontend/components/LanguageSelector'
import { t, type AppLocale } from '@/shared/i18n/locales'

const legalLinks = [
  { href: '/quienes-somos', label: 'Quienes somos' },
  { href: '/politica-editorial', label: 'Politica editorial' },
  { href: '/fuentes-y-metodologia', label: 'Fuentes y metodologia' },
  { href: '/contacto', labelKey: 'footer.contact' },
  { href: '/privacidad', labelKey: 'footer.privacy' },
  { href: '/terminos', labelKey: 'footer.terms' },
  { href: '/cookies', label: 'Cookies' },
] as const

export default function SiteFooter({ locale }: { locale: AppLocale }) {
  return (
    <footer className="px-1 pb-5 sm:px-2 md:px-5 md:pb-7">
      <div className="mx-auto w-full max-w-7xl rounded-2xl border border-[#70ff9d]/12 bg-[#07100d]/92 px-4 py-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.22)] sm:px-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <Link
              href="/"
              className="inline-flex max-w-full transition hover:brightness-110"
              aria-label="Hay Fulbo"
            >
              <BrandMark compact />
            </Link>
            <p className="mt-2 max-w-xl text-xs leading-5 text-[#a9b8b2]">
              {t(locale, 'footer.description')}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-start md:items-end">
            <nav
              aria-label={t(locale, 'footer.legalLabel')}
              className="flex flex-col gap-2 text-sm font-bold text-[#dce7e2] sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"
            >
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 transition hover:border-[#70ff9d]/28 hover:bg-[#70ff9d]/10 hover:text-white"
                >
                  {'labelKey' in link ? t(locale, link.labelKey) : link.label}
                </Link>
              ))}
            </nav>
            <LanguageSelector locale={locale} />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-white/8 pt-3 text-xs leading-5 text-[#83938d] sm:flex-row sm:items-center sm:justify-between">
          <p>Copyright 2026 Hay Fulbo. {t(locale, 'footer.rights')}</p>
          <p>https://hayfulbo.com</p>
        </div>
      </div>
    </footer>
  )
}
