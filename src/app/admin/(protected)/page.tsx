import Link from 'next/link'
import AdminCard from '@/components/admin/AdminCard'
import AdminNotice from '@/components/admin/AdminNotice'
import { getAdminHealthReport, type AdminHealthStatus } from '@/server/admin/health'
import { formatDateTime } from '@/server/admin/shared'
import { getAdminDashboardStats } from '@/server/admin/sync'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const quickLinks = [
  { href: '/admin/sync', label: 'Sincronizacion' },
  { href: '/admin/matches', label: 'Editor de partidos' },
  { href: '/admin/featured-matches', label: 'Partidos destacados' },
  { href: '/admin/broadcasts', label: 'TV manual' },
  { href: '/admin/ads', label: 'Publicidad' },
  { href: '/admin/visibility', label: 'Visibilidad' },
] as const

const healthStatusStyles: Record<AdminHealthStatus, string> = {
  ok: 'border-[#70ff9d]/20 bg-[#0c1c14]/70 text-[#dce7f2]',
  warning: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
  error: 'border-[#ff5f62]/30 bg-[#331414]/70 text-[#ffd5d5]',
}

export default async function AdminDashboardPage() {
  const [statsResult, healthReport] = await Promise.all([
    getAdminDashboardStats(),
    getAdminHealthReport(),
  ])
  const stats = statsResult.data

  return (
    <div className="space-y-4">
      {statsResult.error ? (
        <AdminNotice
          title={statsResult.error.setupRequired ? 'SQL pendiente' : 'Error de datos'}
          message={statsResult.error.message}
          tone="danger"
        />
      ) : null}

      <AdminCard
        title="Auditoría del panel admin"
        description="Chequeos server-side de configuración, permisos y tablas necesarias."
      >
        <div className="grid gap-2 md:grid-cols-2">
          {healthReport.checks.map((check) => (
            <div
              key={check.key}
              className={`rounded-xl border px-3 py-2 ${healthStatusStyles[check.status]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-black">{check.label}</p>
                <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-black uppercase">
                  {check.status}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 opacity-85">{check.detail}</p>
            </div>
          ))}
        </div>
      </AdminCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminCard title="Estado general">
          <p className="text-3xl font-black text-white">
            {stats.status === 'ok' ? 'OK' : 'Revisar'}
          </p>
          <p className="mt-1 text-sm text-[#9aa7b5]">
            Lectura server-side con Supabase service role.
          </p>
        </AdminCard>

        <AdminCard title="Ultima sincronizacion">
          <p className="text-xl font-black text-white">
            {formatDateTime(stats.lastSyncAt)}
          </p>
          <p className="mt-1 text-sm text-[#9aa7b5]">
            Derivado de `football_fixture_cache.updated_at`.
          </p>
        </AdminCard>

        <AdminCard title={`Fixtures ${stats.today.date}`}>
          <p className="text-3xl font-black text-white">{stats.today.fixtures}</p>
          <p className="mt-1 text-sm text-[#9aa7b5]">Cacheados para hoy.</p>
        </AdminCard>

        <AdminCard title={`Fixtures ${stats.tomorrow.date}`}>
          <p className="text-3xl font-black text-white">{stats.tomorrow.fixtures}</p>
          <p className="mt-1 text-sm text-[#9aa7b5]">Cacheados para manana.</p>
        </AdminCard>
      </div>

      <AdminCard
        title="Errores recientes de sync"
        description="No existe una tabla de logs de sync en el esquema actual; se muestra fallback seguro."
      >
        {stats.recentErrors.length ? (
          <ul className="space-y-2 text-sm text-[#ffd5d5]">
            {stats.recentErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#9aa7b5]">No hay datos todavia.</p>
        )}
      </AdminCard>

      <AdminCard title="Accesos rapidos">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hf-button-secondary rounded-xl px-3 py-2 text-sm font-semibold"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </AdminCard>
    </div>
  )
}
