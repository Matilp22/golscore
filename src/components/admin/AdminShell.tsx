import type { ReactNode } from 'react'
import Link from 'next/link'
import AdminSidebar from '@/components/admin/AdminSidebar'

type AdminShellProps = {
  userEmail: string
  children: ReactNode
}

export default function AdminShell({ userEmail, children }: AdminShellProps) {
  return (
    <div className="hf-admin-shell">
      <header className="hf-admin-hero">
        <div className="hf-admin-hero-copy">
          <span className="hf-type-overline">Operaciones · acceso privado</span>
          <h1>Control de cancha</h1>
          <p>
            Datos, contenidos y sincronizaciones de Hay Fulbo en un espacio
            separado de la experiencia pública.
          </p>
        </div>
        <div className="hf-admin-session">
          <span>Sesión autorizada</span>
          <strong>{userEmail}</strong>
          <Link href="/">Volver al sitio</Link>
        </div>
      </header>

      <div className="hf-admin-layout">
        <aside className="hf-admin-sidebar-panel">
          <p>Secciones</p>
          <AdminSidebar />
        </aside>
        <details className="hf-admin-mobile-menu">
          <summary>
            Navegar el panel
          </summary>
          <div>
            <AdminSidebar orientation="grid" />
          </div>
        </details>
        <main className="hf-admin-main">{children}</main>
      </div>
    </div>
  )
}
