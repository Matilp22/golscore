import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import AdminShell from '@/components/admin/AdminShell'
import AdminNotice from '@/components/admin/AdminNotice'
import { getCurrentAdminUser } from '@/server/admin/auth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const current = await getCurrentAdminUser()

  if (current.status === 'not_authenticated') {
    redirect('/admin/login')
  }

  if (current.status === 'supabase_not_configured') {
    return (
      <main className="hf-admin-standalone">
        <AdminNotice
          title="Supabase no está configurado"
          message="Configurá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY para iniciar sesión."
          tone="danger"
        />
      </main>
    )
  }

  if (current.status === 'access_denied') {
    return (
      <main className="hf-admin-standalone">
        <AdminNotice
          title="Acceso denegado"
          message="Tu usuario está conectado, pero el email no está incluido en ADMIN_EMAILS."
          tone="danger"
        />
      </main>
    )
  }

  if (current.status === 'admin_not_configured') {
    return (
      <main className="hf-admin-standalone">
        <AdminNotice
          title="Admin no configurado"
          message="Configurá ADMIN_EMAILS con al menos un email autorizado para habilitar el panel."
          tone="danger"
        />
      </main>
    )
  }

  return (
    <AdminShell userEmail={current.email}>
      {children}
    </AdminShell>
  )
}
