import Link from 'next/link'

import BrandMark from '@/frontend/components/BrandMark'
import LanguageSelector from '@/frontend/components/LanguageSelector'
import { t, type AppLocale } from '@/shared/i18n/locales'

const legalLinks = [
  { href: '/quienes-somos', label: 'Quiénes somos' },
  { href: '/politica-editorial', label: 'Política editorial' },
  { href: '/fuentes-y-metodologia', label: 'Fuentes y metodología' },
  { href: '/contacto', labelKey: 'footer.contact' },
  { href: '/privacidad', labelKey: 'footer.privacy' },
  { href: '/terminos', labelKey: 'footer.terms' },
  { href: '/cookies', label: 'Cookies' },
] as const

export default function SiteFooter({ locale }: { locale: AppLocale }) {
  return (
    <footer className="hf-site-footer">
      <div className="hf-site-footer-inner">
        <div className="hf-site-footer-brand">
          <Link href="/" aria-label="Hay Fulbo, inicio">
            <BrandMark compact />
          </Link>
          <p>{t(locale, 'footer.description')}</p>
        </div>

        <nav
          className="hf-site-footer-links"
          aria-label={t(locale, 'footer.legalLabel')}
        >
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {'labelKey' in link ? t(locale, link.labelKey) : link.label}
            </Link>
          ))}
        </nav>

        <div className="hf-site-footer-meta">
          <LanguageSelector locale={locale} />
          <p>© 2026 Hay Fulbo. {t(locale, 'footer.rights')}</p>
        </div>
      </div>
    </footer>
  )
}
