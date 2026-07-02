import Link from 'next/link'
import {
  MiTorneitoSetupNotice,
  MiTorneitoTournamentCard,
} from '@/frontend/components/mi-torneito/MiTorneitoPublicViews'
import { listPublicMiTorneitoTournaments } from '@/server/mi-torneito/repository'
import { buildSeoMetadata } from '@/shared/seo'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function generateMetadata() {
  return buildSeoMetadata({
    title: 'Torneos de Mi Torneito | Hay Fulbo',
    description: 'Torneos amateur publicados en Mi Torneito.',
    path: '/mi-torneito/torneos',
  })
}

export default async function MiTorneitoTournamentsPage() {
  const tournaments = await listPublicMiTorneitoTournaments(100)

  return (
    <main className="hf-mi-page">
      <MiTorneitoSetupNotice error={tournaments.error} />
      <section className="hf-mi-section">
        <Link href="/mi-torneito" className="hf-mi-back-link">Mi Torneito</Link>
        <p className="hf-mi-kicker">Torneos</p>
        <h1 className="text-3xl font-black text-[#071b2f]">Torneos publicados</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#68717a]">
          Fixture, resultados, posiciones, equipos y links listos para compartir.
        </p>
      </section>

      {tournaments.data.length ? (
        <section className="hf-mi-card-grid">
          {tournaments.data.map((tournament) => (
            <MiTorneitoTournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </section>
      ) : (
        <section className="hf-mi-empty">
          <strong>No hay torneos publicados</strong>
          <span>Cuando se publique el primer torneo, va a aparecer acá.</span>
        </section>
      )}
    </main>
  )
}
