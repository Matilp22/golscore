'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import BackButton from '@/frontend/components/BackButton'
import SidebarNav from '@/frontend/components/SidebarNav'
import { SIDEBAR_SECTION_CONFIGS } from '@/lib/tournament-pages'

type AppShellProps = {
  auth: ReactNode
  children: ReactNode
}

export default function AppShell({ auth, children }: AppShellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const isHome = pathname === '/'

  useEffect(() => {
    if (!isOpen) return

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeydown)

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeydown)
    }
  }, [isOpen])

  const sidebar = (
    <SidebarNav
      sections={SIDEBAR_SECTION_CONFIGS}
      compact
      onNavigate={() => setIsOpen(false)}
    />
  )

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/7 bg-[#0a0d0b]/92 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-2 sm:px-4 lg:flex-nowrap lg:px-5 lg:py-0">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="shrink-0 text-xl font-black tracking-normal text-white transition hover:text-[#7ff0b2] sm:text-2xl"
            >
              FulboApp
            </Link>

            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#10151a]/95 text-white shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition hover:border-[#7ff0b2]/40 lg:hidden"
              aria-label="Abrir menú"
              aria-expanded={isOpen}
            >
              <span className="flex flex-col gap-1.5" aria-hidden="true">
                <span className="h-0.5 w-5 rounded-full bg-[#7ff0b2]" />
                <span className="h-0.5 w-5 rounded-full bg-[#7ff0b2]" />
                <span className="h-0.5 w-5 rounded-full bg-[#7ff0b2]" />
              </span>
            </button>

            {isHome ? null : (
              <div className="hidden sm:block">
                <BackButton />
              </div>
            )}
          </div>

          <div className="ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
            <Link
              href="/prode"
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#25553d] bg-[#163828] px-3 py-2 text-sm font-semibold text-[#7ff0b2] transition hover:bg-[#1b4330] sm:px-4"
            >
              Prode
            </Link>
            {auth}
          </div>
        </div>

        {isHome ? null : (
          <div className="mx-auto w-full max-w-7xl px-3 pb-2 sm:hidden">
            <BackButton />
          </div>
        )}
      </header>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Cerrar menú tocando fuera"
            onClick={() => setIsOpen(false)}
          />
          <aside className="absolute bottom-0 left-0 top-0 flex w-[min(82vw,300px)] max-w-full flex-col border-r border-white/10 bg-[#0f1317] shadow-[18px_0_42px_rgba(0,0,0,0.42)]">
            <div className="flex items-center justify-between border-b border-white/8 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ff0b2]">
                Secciones
              </p>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-base font-bold text-white transition hover:bg-white/[0.08]"
                aria-label="Cerrar menú"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">{sidebar}</div>
          </aside>
        </div>
      ) : null}

      <div className="grid w-full max-w-none gap-3 px-1 pb-3 pt-3 sm:px-2 md:px-5 md:pb-6 lg:mx-auto lg:max-w-7xl lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-4 lg:px-5 lg:pt-4">
        <aside className="hidden h-fit rounded-2xl border border-white/8 bg-[#0f1317]/88 p-2 lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {sidebar}
        </aside>
        <div className="min-w-0">
          {children}
        </div>
      </div>
    </>
  )
}
