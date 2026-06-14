import type { ReactNode } from 'react'
import Link from 'next/link'
import AdminSidebar from '@/components/admin/AdminSidebar'

type AdminShellProps = {
  userEmail: string
  children: ReactNode
}

export default function AdminShell({ userEmail, children }: AdminShellProps) {
  return (
    <div className="space-y-4">
      <header className="hf-hero overflow-hidden rounded-2xl p-4">
        <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#70ff9d]">
              Admin privado
            </p>
            <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">
              Hay Fulbo
            </h1>
            <p className="mt-1 text-sm text-[#b7c3cf]">
              Sesion: {userEmail}
            </p>
          </div>
          <Link
            href="/"
            className="hf-button-secondary inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold"
          >
            Ver sitio
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hf-card-quiet hidden h-fit rounded-2xl p-2 lg:sticky lg:top-24 lg:block">
          <AdminSidebar />
        </aside>
        <div className="lg:hidden">
          <div className="sidebar-scroll overflow-x-auto rounded-2xl border border-white/8 bg-[#0b1211]/90 p-2">
            <div className="flex min-w-max gap-1">
              <AdminSidebar orientation="horizontal" />
            </div>
          </div>
        </div>
        <main className="min-w-0 space-y-4">{children}</main>
      </div>
    </div>
  )
}
