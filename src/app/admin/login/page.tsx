import { Suspense, type ReactNode } from 'react'
import { redirect } from 'next/navigation'
import AuthForm from '@/frontend/components/auth/AuthForm'
import { getCurrentAdminUser } from '@/server/admin/auth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function AdminLoginFrame({ children }: { children: ReactNode }) {
  return (
    <main className="hf-admin-login">
      <section className="hf-admin-login-story" aria-label="Administración Hay Fulbo">
        <span className="hf-type-overline">Operaciones Hay Fulbo</span>
        <p className="hf-admin-login-title">La trastienda del partido.</p>
        <p>
          Un acceso separado para revisar datos, administrar contenidos y
          operar sincronizaciones sin mezclar herramientas internas con la
          navegación pública.
        </p>
        <ul>
          <li>
            <strong>Acceso restringido</strong>
            <span>Solo cuentas incluidas en la configuración privada.</span>
          </li>
          <li>
            <strong>Acciones trazables</strong>
            <span>Cada herramienta conserva sus permisos y confirmaciones.</span>
          </li>
          <li>
            <strong>Producción protegida</strong>
            <span>El rediseño no altera roles, políticas ni credenciales.</span>
          </li>
        </ul>
      </section>
      <div className="hf-admin-login-content">{children}</div>
    </main>
  )
}

function AdminLoginStatus({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <section className="hf-admin-login-status">
      <span className="hf-type-overline">Acceso administrativo</span>
      <h1>{title}</h1>
      <p>{message}</p>
    </section>
  )
}

export default async function AdminLoginPage() {
  const current = await getCurrentAdminUser()

  if (current.status === 'authenticated_admin') {
    redirect('/admin')
  }

  if (current.status === 'access_denied') {
    return (
      <AdminLoginFrame>
        <AdminLoginStatus
          title="Acceso denegado"
          message="Tu usuario está conectado, pero el email no está incluido en ADMIN_EMAILS."
        />
      </AdminLoginFrame>
    )
  }

  if (current.status === 'supabase_not_configured') {
    return (
      <AdminLoginFrame>
        <AdminLoginStatus
          title="Supabase no está configurado"
          message="Configurá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY para iniciar sesión."
        />
      </AdminLoginFrame>
    )
  }

  if (current.status === 'admin_not_configured') {
    return (
      <AdminLoginFrame>
        <AdminLoginStatus
          title="Admin no configurado"
          message="Configurá ADMIN_EMAILS con al menos un email autorizado para habilitar el panel."
        />
      </AdminLoginFrame>
    )
  }

  return (
    <AdminLoginFrame>
      <Suspense fallback={<div className="hf-admin-login-loading">Preparando acceso…</div>}>
        <AuthForm
          mode="login"
          defaultNext="/admin"
          loginDescription="Entrá con una cuenta habilitada en ADMIN_EMAILS."
          showModeSwitch={false}
        />
      </Suspense>
    </AdminLoginFrame>
  )
}
