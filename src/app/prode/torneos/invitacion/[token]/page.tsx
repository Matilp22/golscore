import PrivateTournamentInvitePage from '@/frontend/components/prode/private-tournaments/PrivateTournamentInvitePage'

type PageProps = {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

export default async function ProdePrivateTournamentInviteRoute({ params }: PageProps) {
  const { token } = await params

  return <PrivateTournamentInvitePage token={token} />
}

