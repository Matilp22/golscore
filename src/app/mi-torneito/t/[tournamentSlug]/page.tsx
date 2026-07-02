import { notFound } from 'next/navigation'
import {
  MiTorneitoSetupNotice,
  MiTorneitoTournamentPageView,
} from '@/frontend/components/mi-torneito/MiTorneitoPublicViews'
import { getPublicMiTorneitoTournamentBundle } from '@/server/mi-torneito/repository'
import { absoluteUrl, buildSeoMetadata } from '@/shared/seo'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type PageProps = {
  params: Promise<{
    tournamentSlug: string
  }>
}

export async function generateMetadata({ params }: PageProps) {
  const { tournamentSlug } = await params
  const bundle = await getPublicMiTorneitoTournamentBundle(tournamentSlug)

  if (bundle.error || !bundle.data) {
    return buildSeoMetadata({
      title: 'Torneo | Mi Torneito',
      description: 'Torneo publicado en Mi Torneito de Hay Fulbo.',
      path: `/mi-torneito/t/${tournamentSlug}`,
      noIndex: Boolean(bundle.error),
    })
  }

  return buildSeoMetadata({
    title: `${bundle.data.tournament.name} | Mi Torneito`,
    description: bundle.data.tournament.shortDescription || 'Fixture, tabla y equipos del torneo.',
    path: `/mi-torneito/t/${tournamentSlug}`,
  })
}

export default async function MiTorneitoTournamentPage({ params }: PageProps) {
  const { tournamentSlug } = await params
  const bundle = await getPublicMiTorneitoTournamentBundle(tournamentSlug)

  if (bundle.error) {
    return (
      <main className="hf-mi-page">
        <MiTorneitoSetupNotice error={bundle.error} />
      </main>
    )
  }

  if (!bundle.data) notFound()

  return (
    <MiTorneitoTournamentPageView
      bundle={bundle.data}
      url={absoluteUrl(`/mi-torneito/t/${tournamentSlug}`)}
    />
  )
}
