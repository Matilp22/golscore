import AdminCard from '@/components/admin/AdminCard'
import AdminNotice from '@/components/admin/AdminNotice'
import AdminTable from '@/components/admin/AdminTable'
import ManualSyncForm from '@/components/admin/ManualSyncForm'
import { formatDateTime } from '@/server/admin/shared'
import { getSyncPanelData } from '@/server/admin/sync'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AdminSyncPage() {
  const syncResult = await getSyncPanelData()
  const sync = syncResult.data

  return (
    <div className="space-y-4">
      {syncResult.error ? (
        <AdminNotice
          title={syncResult.error.setupRequired ? 'SQL pendiente' : 'Error de datos'}
          message={syncResult.error.message}
          tone="danger"
        />
      ) : null}

      <AdminCard
        title="Ejecutar sync manual"
        description="Corre la sincronizacion de fixtures desde servidor. No expone CRON_SECRET ni service role al cliente."
      >
        <ManualSyncForm />
      </AdminCard>

      <div className="grid gap-4 md:grid-cols-2">
        <AdminCard title="Ultima actualizacion conocida">
          <p className="text-xl font-black text-white">
            {formatDateTime(sync.lastSyncAt)}
          </p>
          <p className="mt-1 text-sm text-[#9aa7b5]">
            Calculada desde `football_fixture_cache`.
          </p>
        </AdminCard>
        <AdminCard title="Logs de ejecucion">
          <p className="text-sm text-[#9aa7b5]">
            {sync.logsAvailable
              ? 'Hay logs disponibles.'
              : 'No hay tabla de logs de sync; se muestran metricas derivadas.'}
          </p>
        </AdminCard>
      </div>

      <AdminCard title="Fixtures cacheados por fecha">
        {sync.dateSummaries.length ? (
          <AdminTable>
            <thead>
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Fixtures</th>
                <th className="px-3 py-2">Ultima actualizacion</th>
              </tr>
            </thead>
            <tbody>
              {sync.dateSummaries.map((summary) => (
                <tr key={summary.date} className="border-t border-white/8">
                  <td className="px-3 py-2 font-semibold text-white">{summary.date}</td>
                  <td className="px-3 py-2 text-[#dce7f2]">{summary.fixtures}</td>
                  <td className="px-3 py-2 text-[#9aa7b5]">
                    {formatDateTime(summary.lastUpdatedAt)}
                  </td>
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
