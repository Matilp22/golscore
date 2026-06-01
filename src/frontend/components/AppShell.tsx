'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import BackButton from '@/frontend/components/BackButton'
import BrandMark from '@/frontend/components/BrandMark'
import SiteFooter from '@/frontend/components/SiteFooter'
import SidebarNav from '@/frontend/components/SidebarNav'
import { useAuth } from '@/frontend/hooks/useAuth'
import { SIDEBAR_SECTION_CONFIGS } from '@/lib/tournament-pages'
import {
  getSupabaseBrowserClient,
  signOut,
} from '@/lib/supabase/supabaseClient'

type AppShellProps = {
  auth: ReactNode
  children: ReactNode
}

function DrawerChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
      <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MobileAccountSection({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [isOpen, setIsOpen] = useState(true)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const currentUserLabel =
    (typeof user?.user_metadata?.username === 'string' && user.user_metadata.username) ||
    user?.email ||
    'Mi cuenta'

  const handleLogout = () => {
    setError('')

    startTransition(async () => {
      try {
        getSupabaseBrowserClient()
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Supabase no esta configurado.')
        return
      }

      const { error: signOutError } = await signOut()

      if (signOutError) {
        setError('No se pudo cerrar sesion.')
        return
      }

      onNavigate()
      router.replace('/')
      router.refresh()
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#70ff9d]/10 bg-[#0b1412]/90 shadow-[0_8px_24px_rgba(0,0,0,0.14)]">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-[#70ff9d]/10"
        aria-expanded={isOpen}
      >
        <span className="min-w-0 truncate text-sm font-semibold text-[#e4ebf3]">
          Mi cuenta
        </span>
        <DrawerChevron open={isOpen} />
      </button>

      <div className="grid transition-[grid-template-rows,opacity] duration-200" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', opacity: isOpen ? 1 : 0 }}>
        <div className="overflow-hidden">
          <div className="space-y-1 border-t border-white/6 px-2 pb-2 pt-1">
            {isLoading ? (
              <div className="h-9 rounded-xl border border-white/8 bg-white/[0.03]" />
            ) : user ? (
              <>
                <Link
                  href="/perfil"
                  onClick={onNavigate}
                  className="block truncate rounded-xl px-2.5 py-2 text-sm text-[#bcc6d2] transition hover:bg-[#70ff9d]/10 hover:text-white"
                >
                  {currentUserLabel}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isPending}
                  className="block w-full rounded-xl px-2.5 py-2 text-left text-sm text-[#bcc6d2] transition hover:bg-[#70ff9d]/10 hover:text-white disabled:cursor-wait disabled:opacity-70"
                >
                  {isPending ? 'Cerrando...' : 'Cerrar sesion'}
                </button>
                {error ? <p className="px-2.5 text-xs text-[#ffd5d5]">{error}</p> : null}
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={onNavigate}
                  className="block rounded-xl px-2.5 py-2 text-sm text-[#bcc6d2] transition hover:bg-[#70ff9d]/10 hover:text-white"
                >
                  Ingresar
                </Link>
                <Link
                  href="/register"
                  onClick={onNavigate}
                  className="block rounded-xl px-2.5 py-2 text-sm text-[#bcc6d2] transition hover:bg-[#70ff9d]/10 hover:text-white"
                >
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
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
      <header className="hf-shell-top sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 w-full max-w-7xl flex-nowrap items-center justify-between gap-2 px-2 py-2 sm:px-4 lg:min-h-16 lg:px-5 lg:py-0">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="hf-button-secondary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_10px_30px_rgba(0,0,0,0.22)] lg:hidden"
              aria-label="Abrir menú"
              aria-expanded={isOpen}
            >
              <span className="flex flex-col gap-1.5" aria-hidden="true">
                <span className="h-0.5 w-5 rounded-full bg-[#7ff0b2]" />
                <span className="h-0.5 w-5 rounded-full bg-[#7ff0b2]" />
                <span className="h-0.5 w-5 rounded-full bg-[#7ff0b2]" />
              </span>
            </button>

            <Link
              href="/"
              className="min-w-0 shrink transition hover:brightness-110"
              aria-label="HAY FULBO inicio"
            >
              <BrandMark className="max-w-full" />
            </Link>

            {isHome ? null : (
              <div className="hidden lg:block">
                <BackButton />
              </div>
            )}
          </div>

          <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-2">
            <Link
              href="/prode"
              className="hf-button inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl px-3 py-2 text-sm font-black sm:px-4"
            >
              Prode
            </Link>
            <div className="hidden lg:block">
              {auth}
            </div>
          </div>
        </div>
      </header>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Cerrar menú tocando fuera"
            onClick={() => setIsOpen(false)}
          />
          <aside className="absolute bottom-0 left-0 top-0 flex w-[min(82vw,300px)] max-w-full flex-col border-r border-[#70ff9d]/15 bg-[#07100d] shadow-[18px_0_42px_rgba(0,0,0,0.42)]">
            <div className="flex items-center justify-between border-b border-white/8 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#70ff9d]">
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
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <div className="mb-2">
                <MobileAccountSection onNavigate={() => setIsOpen(false)} />
              </div>
              {sidebar}
            </div>
          </aside>
        </div>
      ) : null}

      <div className="grid w-full max-w-none gap-3 px-1 pb-3 pt-3 sm:px-2 md:px-5 md:pb-6 lg:mx-auto lg:max-w-7xl lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-4 lg:px-5 lg:pt-4">
        <aside className="hf-card-quiet sidebar-scroll hidden h-fit rounded-2xl p-2 lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {sidebar}
        </aside>
        <div className="min-w-0">
          {children}
        </div>
      </div>
      <SiteFooter />
    </>
  )
}
