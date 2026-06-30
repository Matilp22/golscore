import TeamsPageClient from '@/frontend/components/teams/TeamsPageClient'
import { buildSeoMetadata } from '@/shared/seo'

export async function generateMetadata() {
  return buildSeoMetadata({
    title: 'Equipos | Hay Fulbo',
    description: 'Gestiona tus equipos favoritos y buscá equipos en Hay Fulbo.',
    path: '/equipos',
  })
}

export default function TeamsPage() {
  return <TeamsPageClient />
}
