import ProdePageShell from '@/frontend/components/prode/ProdePageShell'
import PrivateTournamentsPage from '@/frontend/components/prode/private-tournaments/PrivateTournamentsPage'
import { getRequestLocale } from '@/server/request-locale'
import { t } from '@/shared/i18n/locales'
import { buildNoIndexMetadata } from '@/shared/seo'

export async function generateMetadata() {
  const locale = await getRequestLocale()

  return buildNoIndexMetadata(
    `${t(locale, 'prode.tournamentsTitle')} ${t(locale, 'prode.title')} | Hay Fulbo`,
    t(locale, 'prode.tournamentsSubtitle'),
    '/prode/torneos'
  )
}

export default async function ProdeTournamentsPage() {
  const locale = await getRequestLocale()

  return (
    <ProdePageShell
      eyebrow="Prode privado"
      title={t(locale, 'prode.tournamentsTitle')}
      subtitle={t(locale, 'prode.tournamentsSubtitle')}
      action={{
        href: '/prode',
        label: t(locale, 'prode.backToProde'),
        variant: 'secondary',
      }}
    >
      <PrivateTournamentsPage />
    </ProdePageShell>
  )
}
