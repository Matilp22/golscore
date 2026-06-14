import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import AuthForm from '@/frontend/components/auth/AuthForm'
import AdminNotice from '@/components/admin/AdminNotice'
import { getCurrentAdminUser } from '@/server/admin/auth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AdminLoginPage() {
  const current = await getCurrentAdminUser()

  if (current.status === 'authenticated_admin') {
    redirect('/admin')
  }

  if (current.status === 'access_denied') {
    return (
      <AdminNotice
        title="Acceso denegado"
        message="Tu usuario esta logueado, pero el email no esta incluido en ADMIN_EMAILS."
        tone="danger"
      />
    )
  }

  if (current.status === 'supabase_not_configured') {
    return (
      <AdminNotice
        title="Supabase no esta configurado"
        message="Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY para iniciar sesion."
        tone="danger"
      />
    )
  }

  if (current.status === 'admin_not_configured') {
    return (
      <AdminNotice
        title="Admin no configurado"
        message="Configura ADMIN_EMAILS con al menos un email autorizado para habilitar el panel."
        tone="danger"
      />
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <Suspense fallback={null}>
        <AuthForm
          mode="login"
          defaultNext="/admin"
          loginDescription="Entra con una cuenta habilitada en ADMIN_EMAILS."
          showModeSwitch={false}
        />
      </Suspense>
    </div>
  )
}
