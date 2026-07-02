import Link from 'next/link'
import AdminNotice from '@/components/admin/AdminNotice'
import { MiTorneitoTournamentAdminPanel } from '@/frontend/components/mi-torneito/MiTorneitoAdminForms'
import { getCurrentMiTorneitoAdminUser } from '@/server/mi-torneito/auth'
import { listTournamentsForAdminEmail } from '@/server/mi-torneito/repository'
import { buildSeoMetadata } from '@/shared/seo'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type PageProps = {
  searchParams: Promise<{
    torneo?: string
    saved?: string
    error?: string
  }>
}

export async function generateMetadata() {
  return buildSeoMetadata({
    title: 'Admin Mi Torneito | Hay Fulbo',
    description: 'Panel de administración para torneos asignados en Mi Torneito.',
    path: '/mi-torneito/admin',
    noIndex: true,
  })
}

export default async function MiTorneitoAdminPage({ searchParams }: PageProps) {
  const params = await searchParams
  const current = await getCurrentMiTorneitoAdminUser()

  if (current.status === 'supabase_not_configured') {
    return (
      <main className="hf-mi-page">
        <AdminNotice
          title="Supabase no está configurado"
          message="Configurá Supabase para usar el panel de administradores de torneo."
          tone="danger"
        />
      </main>
    )
  }

  if (current.status === 'not_authenticated') {
    return (
      <main className="hf-mi-page">
        <section className="hf-mi-section">
          <p className="hf-mi-kicker">Panel de torneo</p>
          <h1 className="text-3xl font-black text-[#071b2f]">Iniciá sesión</h1>
          <p className="mt-2 max-w-xl text-sm text-[#68717a]">
            Necesitás una cuenta habilitada por Hay Fulbo para administrar un torneo.
          </p>
          <Link href="/login" className="hf-mi-primary-button mt-4 w-fit">
            Entrar
          </Link>
        </section>
      </main>
    )
  }

  if (current.status === 'access_denied') {
    return (
      <main className="hf-mi-page">
        <section className="hf-mi-section">
          <p className="hf-mi-kicker">Panel de torneo</p>
          <h1 className="text-3xl font-black text-[#071b2f]">Sin torneos asignados</h1>
          <p className="mt-2 max-w-xl text-sm text-[#68717a]">
            Tu cuenta está logueada, pero todavía no tiene un torneo de Mi Torneito asignado.
          </p>
        </section>
      </main>
    )
  }

  const tournaments = await listTournamentsForAdminEmail(current.email)
  const selected =
    tournaments.data.find((bundle) => bundle.tournament.slug === params.torneo) ??
    tournaments.data[0] ??
    null

  return (
    <main className="hf-mi-page">
      {params.saved ? (
        <AdminNotice title="Cambios guardados" message={`Se guardó: ${params.saved}.`} />
      ) : null}
      {params.error ? (
        <AdminNotice title="No se pudo guardar" message={params.error} tone="danger" />
      ) : null}
      {tournaments.error ? (
        <AdminNotice
          title={tournaments.error.setupRequired ? 'SQL pendiente' : 'Error'}
          message={tournaments.error.message}
          tone="danger"
        />
      ) : null}

      <section className="hf-mi-section">
        <p className="hf-mi-kicker">Panel del organizador</p>
        <h1 className="text-3xl font-black text-[#071b2f]">Mi Torneito Admin</h1>
        <p className="mt-2 max-w-xl text-sm text-[#68717a]">
          Sesión: {current.email}. Desde acá podés cargar equipos, fixture y resultados de tus torneos.
        </p>
        {tournaments.data.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tournaments.data.map((bundle) => (
              <Link
                key={bundle.tournament.id}
                href={`/mi-torneito/admin?torneo=${bundle.tournament.slug}`}
                className={`rounded-full border px-3 py-2 text-sm font-black ${
                  selected?.tournament.id === bundle.tournament.id
                    ? 'border-[#58c91f] bg-[#58c91f] text-[#071b2f]'
                    : 'border-[#071b2f]/15 bg-white text-[#071b2f]'
                }`}
              >
                {bundle.tournament.name}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      {selected ? (
        <MiTorneitoTournamentAdminPanel
          bundle={selected}
          returnPath={`/mi-torneito/admin?torneo=${selected.tournament.slug}`}
          showSuperAdminTools={false}
        />
      ) : (
        <section className="hf-mi-empty">
          <strong>No hay torneos disponibles</strong>
          <span>Cuando un superadmin te asigne un torneo, va a aparecer acá.</span>
        </section>
      )}
    </main>
  )
}
