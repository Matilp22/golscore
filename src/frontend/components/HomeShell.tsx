'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

type HomeShellProps = {
  sidebar: ReactNode
  children: ReactNode
}

export default function HomeShell({ sidebar, children }: HomeShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const sidebarRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isSidebarOpen) return

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsSidebarOpen(false)
    }

    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [isSidebarOpen])

  return (
    <>
      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        className="fixed left-3 top-3 z-40 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#10151a]/95 text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur transition hover:border-[#7ff0b2]/40 lg:hidden"
        aria-label="Abrir secciones"
        aria-expanded={isSidebarOpen}
      >
        <span className="flex flex-col gap-1.5" aria-hidden="true">
          <span className="h-0.5 w-5 rounded-full bg-[#7ff0b2]" />
          <span className="h-0.5 w-5 rounded-full bg-[#7ff0b2]" />
          <span className="h-0.5 w-5 rounded-full bg-[#7ff0b2]" />
        </span>
      </button>

      {isSidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            aria-label="Cerrar secciones tocando fuera"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div
            ref={sidebarRef}
            className="absolute bottom-0 left-0 top-0 w-[min(88vw,340px)] max-w-full overflow-y-auto border-r border-white/10 bg-[#0f1317] p-3 shadow-[18px_0_50px_rgba(0,0,0,0.45)]"
          >
            <div className="mb-3 flex items-center justify-between border-b border-white/6 pb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7ff0b2]">
                Secciones
              </p>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-lg font-bold text-white transition hover:bg-white/[0.08]"
                aria-label="Cerrar menu de secciones"
              >
                x
              </button>
            </div>
            <div onClick={() => setIsSidebarOpen(false)}>{sidebar}</div>
          </div>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden h-fit rounded-2xl border border-white/8 bg-[#0f1317]/90 p-3 lg:sticky lg:top-5 lg:flex lg:max-h-[calc(100vh-2.5rem)] lg:flex-col">
          <div className="mb-3 border-b border-white/6 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7ff0b2]">
              Secciones
            </p>
          </div>
          {sidebar}
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </>
  )
}
