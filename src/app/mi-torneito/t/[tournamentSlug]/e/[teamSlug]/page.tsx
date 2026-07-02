import { notFound } from 'next/navigation'
import {
  MiTorneitoSetupNotice,
  MiTorneitoTeamPageView,
} from '@/frontend/components/mi-torneito/MiTorneitoPublicViews'
import { getPublicMiTorneitoTournamentBundle } from '@/server/mi-torneito/repository'
import { absoluteUrl, buildSeoMetadata } from '@/shared/seo'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type PageProps = {
  params: Promise<{
    tournamentSlug: string
    teamSlug: string
  }>
}

export async function generateMetadata({ params }: PageProps) {
  const { tournamentSlug, teamSlug } = await params
  const bundle = await getPublicMiTorneitoTournamentBundle(tournamentSlug)
  const team = bundle.data?.teams.find((item) => item.slug === teamSlug)

  return buildSeoMetadata({
    title: team ? `${team.name} | ${bundle.data?.tournament.name}` : 'Equipo | Mi Torneito',
    description: team ? `Fixture y campaña de ${team.name}.` : 'Equipo publicado en Mi Torneito.',
    path: `/mi-torneito/t/${tournamentSlug}/e/${teamSlug}`,
    noIndex: Boolean(bundle.error || !team),
  })
}

export default async function MiTorneitoTeamPage({ params }: PageProps) {
  const { tournamentSlug, teamSlug } = await params
  const bundle = await getPublicMiTorneitoTournamentBundle(tournamentSlug)

  if (bundle.error) {
    return (
      <main className="hf-mi-page">
        <MiTorneitoSetupNotice error={bundle.error} />
      </main>
    )
  }

  if (!bundle.data) notFound()

  const team = bundle.data.teams.find((item) => item.slug === teamSlug)
  if (!team) notFound()

  return (
    <MiTorneitoTeamPageView
      bundle={bundle.data}
      team={team}
      url={absoluteUrl(`/mi-torneito/t/${tournamentSlug}/e/${teamSlug}`)}
    />
  )
}
