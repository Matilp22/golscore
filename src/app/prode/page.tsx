import ProdePageShell from '@/frontend/components/prode/ProdePageShell'
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
    <ProdePageShell
      title={t(locale, 'prode.title')}
      subtitle={t(locale, 'prode.subtitle')}
      action={{
        href: '/prode/torneos',
        label: t(locale, 'prode.tournaments'),
      }}
      secondaryAction={{
        href: '/liga/selecciones-mundial',
        label: 'Copa del Mundo 2026',
      }}
    >
      <ProdePanel />
    </ProdePageShell>
  )
}
