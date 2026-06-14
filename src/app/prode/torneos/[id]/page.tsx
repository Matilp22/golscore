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

  return (
    <div className="min-h-screen overflow-x-hidden text-white">
      <div className="w-full px-2 py-3 md:mx-auto md:max-w-6xl md:px-4 md:py-6">
        <PrivateTournamentDetailPage tournamentId={id} />
      </div>
    </div>
  )
}
