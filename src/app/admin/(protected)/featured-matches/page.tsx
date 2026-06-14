import AdminCard from '@/components/admin/AdminCard'
import AdminNotice from '@/components/admin/AdminNotice'
import AdminTable from '@/components/admin/AdminTable'
import { saveFeaturedMatchAction } from '@/app/admin/actions'
import { getFeaturedMatchesPageData } from '@/server/admin/featured-matches'
import { formatDateTime } from '@/server/admin/shared'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type PageProps = {
  searchParams: Promise<{
    q?: string
  }>
}

export default async function AdminFeaturedMatchesPage({
  searchParams,
}: PageProps) {
  const params = await searchParams
  const query = params.q ?? ''
  const pageResult = await getFeaturedMatchesPageData(query)
  const { fixtures, featuredMatches } = pageResult.data
  const featuredByFixture = new Map(
    featuredMatches.map((match) => [match.fixture_external_id, match])
  )

  return (
    <div className="space-y-4">
      {pageResult.error ? (
        <AdminNotice
          title={pageResult.error.setupRequired ? 'SQL pendiente' : 'Error de datos'}
          message={pageResult.error.message}
          tone="danger"
        />
      ) : null}

      <AdminCard
        title="Partidos destacados"
        description="Marca partidos cacheados para destacarlos luego en Home o paginas principales."
      >
        <form className="mb-4 flex flex-col gap-2 sm:flex-row" action="/admin/featured-matches">
          <input
            name="q"
            defaultValue={query}
            placeholder="Buscar por equipo, liga o fixture id"
            className="hf-input h-11 flex-1 rounded-xl px-3 text-sm"
          />
          <button className="hf-button h-11 rounded-xl px-4 text-sm font-black" type="submit">
            Buscar
          </button>
        </form>

        {fixtures.length ? (
          <div className="space-y-3">
            {fixtures.map((fixture) => {
              const featured = featuredByFixture.get(fixture.fixtureExternalId)

              return (
                <form
                  key={fixture.cacheId}
                  action={saveFeaturedMatchAction}
                  className="rounded-xl border border-white/8 bg-black/10 p-3"
                >
                  <input type="hidden" name="fixtureExternalId" value={fixture.fixtureExternalId} />
                  <input type="hidden" name="homeTeam" value={fixture.homeTeam ?? ''} />
                  <input type="hidden" name="awayTeam" value={fixture.awayTeam ?? ''} />
                  <input type="hidden" name="leagueName" value={fixture.leagueName ?? ''} />
                  <input type="hidden" name="matchDate" value={fixture.matchDate ?? ''} />

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_160px]">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white">
                        {fixture.homeTeam ?? 'Local'} vs {fixture.awayTeam ?? 'Visitante'}
                      </p>
                      <p className="mt-1 text-xs text-[#9aa7b5]">
                        {fixture.leagueName ?? 'Liga sin dato'} - Fixture {fixture.fixtureExternalId} - {formatDateTime(fixture.matchDate)}
                      </p>
                      <input
                        name="title"
                        defaultValue={featured?.title ?? ''}
                        placeholder="Titulo opcional"
                        className="hf-input mt-3 h-10 w-full rounded-xl px-3 text-sm"
                      />
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold text-[#c8d0da]">
                        Prioridad
                      </span>
                      <input
                        name="priority"
                        type="number"
                        defaultValue={featured?.priority ?? 100}
                        min="0"
                        max="10000"
                        className="hf-input h-10 w-full rounded-xl px-3 text-sm"
                      />
                    </label>

                    <div className="flex flex-col justify-between gap-3">
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#dce7f2]">
                        <input
                          type="checkbox"
                          name="featured"
                          defaultChecked={featured?.featured ?? false}
                          className="h-4 w-4 accent-[#70ff9d]"
                        />
                        Destacado
                      </label>
                      <button className="hf-button h-10 rounded-xl px-4 text-sm font-black" type="submit">
                        Guardar
                      </button>
                    </div>
                  </div>

                  <input
                    name="note"
                    defaultValue={featured?.note ?? ''}
                    placeholder="Nota interna"
                    className="hf-input mt-3 h-10 w-full rounded-xl px-3 text-sm"
                  />
                </form>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-[#9aa7b5]">No hay datos todavia.</p>
        )}
      </AdminCard>

      <AdminCard title="Destacados actuales">
        {featuredMatches.length ? (
          <AdminTable>
            <thead>
              <tr>
                <th className="px-3 py-2">Fixture</th>
                <th className="px-3 py-2">Partido</th>
                <th className="px-3 py-2">Liga</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Prioridad</th>
              </tr>
            </thead>
            <tbody>
              {featuredMatches.map((match) => (
                <tr key={match.id} className="border-t border-white/8">
                  <td className="px-3 py-2 font-mono text-xs text-[#dce7f2]">
                    {match.fixture_external_id}
                  </td>
                  <td className="px-3 py-2 text-white">
                    {match.title || `${match.home_team ?? 'Local'} vs ${match.away_team ?? 'Visitante'}`}
                  </td>
                  <td className="px-3 py-2 text-[#9aa7b5]">{match.league_name ?? 'Sin dato'}</td>
                  <td className="px-3 py-2">
                    <span className="hf-badge rounded-full px-2 py-1 text-xs font-black">
                      {match.featured ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#dce7f2]">{match.priority}</td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        ) : (
          <p className="text-sm text-[#9aa7b5]">No hay datos todavia.</p>
        )}
      </AdminCard>
    </div>
  )
}
