import {
  MiTorneitoLanding,
} from '@/frontend/components/mi-torneito/MiTorneitoPublicViews'
import { listPublicMiTorneitoTournaments } from '@/server/mi-torneito/repository'
import { buildSeoMetadata } from '@/shared/seo'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type PageProps = {
  searchParams: Promise<{
    solicitud?: string
    mensaje?: string
  }>
}

export async function generateMetadata() {
  return buildSeoMetadata({
    title: 'Mi Torneito | Hay Fulbo',
    description: 'Crea y comparte tu torneo amateur con fixture, resultados, equipos y tabla de posiciones.',
    path: '/mi-torneito',
  })
}

export default async function MiTorneitoPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tournaments = await listPublicMiTorneitoTournaments(6)
  const feedback =
    params.solicitud === 'ok'
      ? {
          kind: 'success' as const,
          message: 'Solicitud enviada. Te vamos a contactar para armar el torneo.',
        }
      : params.solicitud === 'error'
        ? {
            kind: 'error' as const,
            message: params.mensaje || 'No se pudo enviar la solicitud.',
          }
        : null

  return (
    <MiTorneitoLanding
      tournaments={tournaments.data}
      error={tournaments.error}
      feedback={feedback}
    />
  )
}
