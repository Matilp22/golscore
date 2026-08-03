import MiTorneitoUtilityLanding from '@/frontend/components/mi-torneito/MiTorneitoUtilityLanding'
import { MiTorneitoSetupNotice } from '@/frontend/components/mi-torneito/MiTorneitoPublicViews'
import { listPublicMiTorneitoTournaments } from '@/server/mi-torneito/repository'
import { buildSeoMetadata } from '@/shared/seo'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function generateMetadata() {
  return buildSeoMetadata({
    title: 'Mi Torneito | Hay Fulbo',
    description: 'Crea y comparte tu torneo amateur con fixture, resultados, equipos y tabla de posiciones.',
    path: '/mi-torneito',
  })
}

export default async function MiTorneitoPage() {
  const tournaments = await listPublicMiTorneitoTournaments(6)

  return (
    <>
      <MiTorneitoSetupNotice error={tournaments.error} />
      <MiTorneitoUtilityLanding tournaments={tournaments.data} />
    </>
  )
}
