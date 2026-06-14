import AdminCard from '@/components/admin/AdminCard'
import AdminNotice from '@/components/admin/AdminNotice'
import {
  createBroadcastOverrideAction,
  deleteBroadcastOverrideAction,
  saveBroadcastOverrideAction,
} from '@/app/admin/actions'
import { getBroadcastsPageData } from '@/server/admin/broadcasts'
import { formatDateTime } from '@/server/admin/shared'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type PageProps = {
  searchParams: Promise<{
    q?: string
  }>
}

export default async function AdminBroadcastsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = params.q ?? ''
  const pageResult = await getBroadcastsPageData(query)
  const { fixtures, overrides } = pageResult.data

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
        title="TV / transmisiones manuales"
        description="Agrega canales como overrides internos por fixture sin modificar datos crudos de API-Football."
      >
        <form className="mb-4 flex flex-col gap-2 sm:flex-row" action="/admin/broadcasts">
          <input
            name="q"
            defaultValue={query}
            placeholder="Buscar por fixture id, equipo, liga o canal"
            className="hf-input h-11 flex-1 rounded-xl px-3 text-sm"
          />
          <button className="hf-button h-11 rounded-xl px-4 text-sm font-black" type="submit">
            Buscar
          </button>
        </form>

        {fixtures.length ? (
          <div className="space-y-3">
            {fixtures.map((fixture) => (
              <div
                key={fixture.cacheId}
                className="rounded-xl border border-white/8 bg-black/10 p-3"
              >
                <div className="mb-3">
                  <p className="text-sm font-black text-white">
                    {fixture.homeTeam ?? 'Local'} vs {fixture.awayTeam ?? 'Visitante'}
                  </p>
                  <p className="mt-1 text-xs text-[#9aa7b5]">
                    {fixture.leagueName ?? 'Liga sin dato'} - Fixture {fixture.fixtureExternalId} - {formatDateTime(fixture.matchDate)}
                  </p>
                </div>

                <form
                  action={createBroadcastOverrideAction}
                  className="grid gap-2 md:grid-cols-[1fr_1fr_120px_110px_auto]"
                >
                  <input type="hidden" name="fixtureExternalId" value={fixture.fixtureExternalId} />
                  <input
                    name="broadcasterName"
                    required
                    placeholder="Canal"
                    className="hf-input h-10 rounded-xl px-3 text-sm"
                  />
                  <input
                    name="broadcasterLogoUrl"
                    placeholder="Logo URL"
                    className="hf-input h-10 rounded-xl px-3 text-sm"
                  />
                  <input
                    name="country"
                    placeholder="Pais"
                    className="hf-input h-10 rounded-xl px-3 text-sm"
                  />
                  <input
                    name="priority"
                    type="number"
                    defaultValue="100"
                    min="0"
                    max="10000"
                    className="hf-input h-10 rounded-xl px-3 text-sm"
                  />
                  <button className="hf-button h-10 rounded-xl px-4 text-sm font-black" type="submit">
                    Agregar
                  </button>
                  <input
                    name="note"
                    placeholder="Nota interna"
                    className="hf-input h-10 rounded-xl px-3 text-sm md:col-span-5"
                  />
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#9aa7b5]">No hay datos todavia.</p>
        )}
      </AdminCard>

      <AdminCard title="Overrides existentes">
        {overrides.length ? (
          <div className="space-y-3">
            {overrides.map((override) => (
              <div
                key={override.id}
                className="rounded-xl border border-white/8 bg-black/10 p-3"
              >
                <form
                  action={saveBroadcastOverrideAction}
                  className="grid gap-2 lg:grid-cols-[140px_1fr_1fr_120px_110px_auto]"
                >
                  <input type="hidden" name="id" value={override.id} />
                  <div>
                    <p className="text-xs font-semibold text-[#9aa7b5]">Fixture</p>
                    <p className="font-mono text-xs text-[#dce7f2]">{override.fixture_external_id}</p>
                  </div>
                  <input
                    name="broadcasterName"
                    required
                    defaultValue={override.broadcaster_name}
                    className="hf-input h-10 rounded-xl px-3 text-sm"
                  />
                  <input
                    name="broadcasterLogoUrl"
                    defaultValue={override.broadcaster_logo_url ?? ''}
                    placeholder="Logo URL"
                    className="hf-input h-10 rounded-xl px-3 text-sm"
                  />
                  <input
                    name="country"
                    defaultValue={override.country ?? ''}
                    placeholder="Pais"
                    className="hf-input h-10 rounded-xl px-3 text-sm"
                  />
                  <input
                    name="priority"
                    type="number"
                    defaultValue={override.priority}
                    min="0"
                    max="10000"
                    className="hf-input h-10 rounded-xl px-3 text-sm"
                  />
                  <button className="hf-button h-10 rounded-xl px-4 text-sm font-black" type="submit">
                    Guardar
                  </button>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#dce7f2] lg:col-start-2">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={override.active}
                      className="h-4 w-4 accent-[#70ff9d]"
                    />
                    Activo
                  </label>
                  <input
                    name="note"
                    defaultValue={override.note ?? ''}
                    placeholder="Nota interna"
                    className="hf-input h-10 rounded-xl px-3 text-sm lg:col-span-4"
                  />
                </form>
                <form action={deleteBroadcastOverrideAction} className="mt-2">
                  <input type="hidden" name="id" value={override.id} />
                  <button
                    type="submit"
                    className="hf-button-secondary rounded-xl px-3 py-2 text-xs font-semibold text-[#ffd5d5]"
                  >
                    Eliminar override
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#9aa7b5]">No hay datos todavia.</p>
        )}
      </AdminCard>
    </div>
  )
}
