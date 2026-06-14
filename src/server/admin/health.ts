import 'server-only'

import { getAdminClient, isMissingRelationError } from '@/server/admin/shared'

export type AdminHealthStatus = 'ok' | 'warning' | 'error'

export type AdminHealthCheck = {
  key: string
  label: string
  status: AdminHealthStatus
  detail: string
}

export type AdminHealthReport = {
  status: AdminHealthStatus
  checks: AdminHealthCheck[]
}

const REQUIRED_TABLES = [
  { name: 'football_fixture_cache', label: 'Cache de fixtures' },
  { name: 'admin_featured_matches', label: 'Partidos destacados' },
  { name: 'admin_broadcast_overrides', label: 'Overrides de TV' },
  { name: 'admin_ad_slots', label: 'Slots de publicidad' },
  { name: 'admin_visibility_rules', label: 'Reglas de visibilidad' },
] as const

function checkEnv() {
  const checks: AdminHealthCheck[] = []
  const hasPublicUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const adminEmailCount = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean).length

  checks.push({
    key: 'supabase-public-config',
    label: 'Supabase publico',
    status: hasPublicUrl && hasAnonKey ? 'ok' : 'error',
    detail: hasPublicUrl && hasAnonKey
      ? 'NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY configuradas.'
      : 'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.',
  })

  checks.push({
    key: 'supabase-service-role',
    label: 'Supabase service role',
    status: hasServiceRole ? 'ok' : 'error',
    detail: hasServiceRole
      ? 'SUPABASE_SERVICE_ROLE_KEY configurada para consultas privadas del admin.'
      : 'Falta SUPABASE_SERVICE_ROLE_KEY. El admin no puede leer ni escribir tablas privadas.',
  })

  checks.push({
    key: 'admin-emails',
    label: 'ADMIN_EMAILS',
    status: adminEmailCount > 0 ? 'ok' : 'error',
    detail: adminEmailCount > 0
      ? `${adminEmailCount} email(s) habilitado(s) para entrar al admin.`
      : 'Falta ADMIN_EMAILS. Ningun usuario puede quedar autorizado como admin.',
  })

  return checks
}

function getOverallStatus(checks: AdminHealthCheck[]): AdminHealthStatus {
  if (checks.some((check) => check.status === 'error')) return 'error'
  if (checks.some((check) => check.status === 'warning')) return 'warning'

  return 'ok'
}

export async function getAdminHealthReport(): Promise<AdminHealthReport> {
  const checks = checkEnv()
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!hasServiceRole) {
    checks.push(
      ...REQUIRED_TABLES.map((table) => ({
        key: `table-${table.name}`,
        label: table.label,
        status: 'warning' as const,
        detail: 'No auditado porque falta SUPABASE_SERVICE_ROLE_KEY.',
      }))
    )

    return {
      status: getOverallStatus(checks),
      checks,
    }
  }

  try {
    const supabase = getAdminClient()

    const tableChecks = await Promise.all(
      REQUIRED_TABLES.map(async (table): Promise<AdminHealthCheck> => {
        const { count, error } = await supabase
          .from(table.name)
          .select('id', { count: 'exact', head: true })

        if (error) {
          return {
            key: `table-${table.name}`,
            label: table.label,
            status: isMissingRelationError(error) ? 'error' : 'warning',
            detail: error.message,
          }
        }

        return {
          key: `table-${table.name}`,
          label: table.label,
          status: 'ok',
          detail: `${count ?? 0} registro(s) accesibles por service role.`,
        }
      })
    )

    checks.push(...tableChecks)
  } catch (error) {
    checks.push({
      key: 'admin-health-runtime',
      label: 'Auditoria admin',
      status: 'error',
      detail: error instanceof Error ? error.message : 'No se pudo auditar el panel admin.',
    })
  }

  return {
    status: getOverallStatus(checks),
    checks,
  }
}
