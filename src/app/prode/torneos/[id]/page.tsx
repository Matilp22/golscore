import ProdePageShell from '@/frontend/components/prode/ProdePageShell'
import PrivateTournamentDetailPage from '@/frontend/components/prode/private-tournaments/PrivateTournamentDetailPage'
import { getRequestLocale } from '@/server/request-locale'
import { t } from '@/shared/i18n/locales'
import { buildNoIndexMetadata } from '@/shared/seo'

type ProdeTournamentDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: ProdeTournamentDetailPageProps) {
  const { id } = await params
  const locale = await getRequestLocale()

  return buildNoIndexMetadata(
    `${t(locale, 'privateTournaments.detailTitle')} | Hay Fulbo`,
    t(locale, 'privateTournaments.tournamentTable'),
    `/prode/torneos/${id}`
  )
}

export default async function ProdeTournamentDetailPage({
  params,
}: ProdeTournamentDetailPageProps) {
  const { id } = await params
  const locale = await getRequestLocale()

  return (
    <ProdePageShell
      eyebrow="Torneo privado"
      title={t(locale, 'privateTournaments.detailTitle')}
      subtitle={t(locale, 'privateTournaments.tournamentTable')}
      action={{
        href: '/prode/torneos',
        label: t(locale, 'privateTournaments.backToTournaments'),
        variant: 'secondary',
      }}
    >
      <PrivateTournamentDetailPage tournamentId={id} />
    </ProdePageShell>
  )
}
