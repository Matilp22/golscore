import { notFound } from 'next/navigation'
import {
  MiTorneitoMatchPageView,
  MiTorneitoSetupNotice,
} from '@/frontend/components/mi-torneito/MiTorneitoPublicViews'
import { getPublicMiTorneitoTournamentBundle } from '@/server/mi-torneito/repository'
import { getMiTorneitoMatchLabel } from '@/shared/mi-torneito/utils'
import { absoluteUrl, buildSeoMetadata } from '@/shared/seo'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type PageProps = {
  params: Promise<{
    tournamentSlug: string
    matchId: string
  }>
}

export async function generateMetadata({ params }: PageProps) {
  const { tournamentSlug, matchId } = await params
  const bundle = await getPublicMiTorneitoTournamentBundle(tournamentSlug)
  const match = bundle.data?.matches.find((item) => item.id === matchId)

  return buildSeoMetadata({
    title: match && bundle.data
      ? `${getMiTorneitoMatchLabel(match, bundle.data.teams)} | ${bundle.data.tournament.name}`
      : 'Partido | Mi Torneito',
    description: 'Detalle público del partido en Mi Torneito.',
    path: `/mi-torneito/t/${tournamentSlug}/p/${matchId}`,
    noIndex: Boolean(bundle.error || !match),
  })
}

export default async function MiTorneitoMatchPage({ params }: PageProps) {
  const { tournamentSlug, matchId } = await params
  const bundle = await getPublicMiTorneitoTournamentBundle(tournamentSlug)

  if (bundle.error) {
    return (
      <main className="hf-mi-page">
        <MiTorneitoSetupNotice error={bundle.error} />
      </main>
    )
  }

  if (!bundle.data) notFound()

  const match = bundle.data.matches.find((item) => item.id === matchId)
  if (!match) notFound()

  return (
    <MiTorneitoMatchPageView
      bundle={bundle.data}
      match={match}
      url={absoluteUrl(`/mi-torneito/t/${tournamentSlug}/p/${matchId}`)}
    />
  )
}
