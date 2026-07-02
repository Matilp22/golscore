import ProdePageShell from '@/frontend/components/prode/ProdePageShell'
import PrivateTournamentInvitePage from '@/frontend/components/prode/private-tournaments/PrivateTournamentInvitePage'
import { getRequestLocale } from '@/server/request-locale'
import { t } from '@/shared/i18n/locales'

type PageProps = {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

export default async function ProdePrivateTournamentInviteRoute({ params }: PageProps) {
  const { token } = await params
  const locale = await getRequestLocale()

  return (
    <ProdePageShell
      eyebrow="Invitacion Prode"
      title={t(locale, 'privateTournaments.invitePageTitle')}
      subtitle={t(locale, 'privateTournaments.inviteAcceptDescription')}
      action={{
        href: '/prode/torneos',
        label: t(locale, 'privateTournaments.goToTournaments'),
        variant: 'secondary',
      }}
    >
      <PrivateTournamentInvitePage token={token} />
    </ProdePageShell>
  )
}

