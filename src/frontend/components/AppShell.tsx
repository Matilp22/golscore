'use client'

import { useEffect, useState, type ReactNode } from 'react'
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
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed left-3 top-3 z-40 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#10151a]/95 text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur transition hover:border-[#7ff0b2]/40 lg:hidden"
        aria-label="Abrir menú"
        aria-expanded={isOpen}
      >
        <span className="flex flex-col gap-1.5" aria-hidden="true">
          <span className="h-0.5 w-5 rounded-full bg-[#7ff0b2]" />
          <span className="h-0.5 w-5 rounded-full bg-[#7ff0b2]" />
          <span className="h-0.5 w-5 rounded-full bg-[#7ff0b2]" />
        </span>
      </button>

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
                FulboApp
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

      <div className={`grid w-full max-w-none gap-3 px-1 pb-3 pt-16 sm:px-2 md:px-5 md:pb-6 md:pt-16 lg:mx-auto lg:max-w-7xl lg:gap-4 lg:px-5 lg:pt-4 ${isHome ? '' : 'lg:grid-cols-[210px_minmax(0,1fr)]'}`}>
        {isHome ? null : (
          <aside className="hidden h-fit rounded-2xl border border-white/8 bg-[#0f1317]/88 p-2 lg:sticky lg:top-4 lg:mt-[68px] lg:block lg:max-h-[calc(100vh-6.25rem)] lg:overflow-y-auto">
            {sidebar}
          </aside>
        )}
        <div className="min-w-0">
          <div className="mb-3 flex min-h-10 items-center justify-between gap-3">
            <div>{isHome ? null : <BackButton />}</div>
            {auth}
          </div>
          {children}
        </div>
      </div>
    </>
  )
}
