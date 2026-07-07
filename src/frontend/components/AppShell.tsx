'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import AppAudioPreferenceBridge from '@/frontend/components/AppAudioPreferenceBridge'
import BackButton from '@/frontend/components/BackButton'
import BrandMark from '@/frontend/components/BrandMark'
import FavoriteTeamsList from '@/frontend/components/favorites/FavoriteTeamsList'
import GlobalSearch from '@/frontend/components/global/GlobalSearch'
import NotificationBell from '@/frontend/components/global/NotificationBell'
import { LocaleProvider } from '@/frontend/components/LocaleProvider'
import SiteFooter from '@/frontend/components/SiteFooter'
import SidebarNav from '@/frontend/components/SidebarNav'
import GoogleAdSlot from '@/frontend/components/ads/GoogleAdSlot'
import TournamentAudioController from '@/frontend/components/TournamentAudioController'
import { useAuth } from '@/frontend/hooks/useAuth'
import { HEADER_ACTIONS } from '@/frontend/navigation/sidebar-navigation'
import { SIDEBAR_SECTION_CONFIGS } from '@/lib/tournament-pages'
import { shouldAllowAdsOnRoute } from '@/shared/content-quality'
import {
  getSupabaseBrowserClient,
  signOut,
} from '@/lib/supabase/supabaseClient'
import { t, type AppLocale } from '@/shared/i18n/locales'

type AppShellProps = {
  auth: ReactNode
  children: ReactNode
  locale: AppLocale
}

type ProfileQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{
        data: { username?: string | null } | null
        error: { message: string; code?: string; details?: string | null } | null
      }>
    }
  }
}

function profilesQuery() {
  return getSupabaseBrowserClient().from('profiles' as 'leagues') as unknown as ProfileQuery
}

function DrawerChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
      <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function getHeaderActionClassName(accent: (typeof HEADER_ACTIONS)[number]['accent']) {
  if (accent === 'simulator') {
    return 'hf-global-action is-simulator'
  }

  return 'hf-global-action'
}

type ShellIconName =
  | 'home'
  | 'ball'
  | 'trophy'
  | 'shield'
  | 'table'
  | 'news'
  | 'chart'
  | 'star'
  | 'search'
  | 'bell'
  | 'user'
  | 'more'

const PRIMARY_NAV_ITEMS: Array<{ key: string; label: string; href: string; icon: ShellIconName }> = [
  { key: 'home', label: 'Inicio', href: '/', icon: 'home' },
  { key: 'mi-torneito', label: 'Mi Torneito', href: '/mi-torneito', icon: 'trophy' },
  { key: 'competitions', label: 'Competiciones', href: '/competiciones', icon: 'trophy' },
  { key: 'teams', label: 'Equipos', href: '/equipos', icon: 'shield' },
  { key: 'prode', label: 'Prode', href: '/prode', icon: 'trophy' },
  { key: 'news', label: 'Noticias', href: '/noticias', icon: 'news' },
  { key: 'stats', label: 'Estadisticas', href: '/estadisticas', icon: 'chart' },
  { key: 'favorites', label: 'Favoritos', href: '/#favoritos', icon: 'star' },
]

const MOBILE_BOTTOM_ITEMS: Array<{
  key: string
  label: string
  href?: string
  icon: ShellIconName
  opensFavorites?: boolean
  opensMore?: boolean
}> = [
  { key: 'home', label: 'Inicio', href: '/', icon: 'home' },
  { key: 'prode', label: 'Prode', href: '/prode', icon: 'trophy' },
  { key: 'favorites', label: 'Favoritos', icon: 'star', opensFavorites: true },
  { key: 'competitions', label: 'Competiciones', href: '/competiciones', icon: 'trophy' },
  { key: 'more', label: 'Mas', icon: 'more', opensMore: true },
]

const MOBILE_MORE_ITEMS: Array<{
  key: string
  label: string
  href: string
  icon: ShellIconName
  needsAuthRoute?: boolean
}> = [
  { key: 'mi-torneito', label: 'Mi Torneito', href: '/mi-torneito', icon: 'trophy' },
  { key: 'news', label: 'Noticias', href: '/noticias', icon: 'news' },
  { key: 'matches', label: 'Partidos', href: '/#partidos', icon: 'ball' },
  { key: 'stats', label: 'Estadisticas', href: '/estadisticas', icon: 'chart' },
  { key: 'teams', label: 'Equipos', href: '/equipos', icon: 'shield' },
  { key: 'profile', label: 'Perfil', href: '/perfil', icon: 'user', needsAuthRoute: true },
]

function ShellIcon({ name, className = 'h-5 w-5' }: { name: ShellIconName; className?: string }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
  }

  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    )
  }

  if (name === 'ball') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <circle {...common} cx="12" cy="12" r="9" />
        <path {...common} d="m8.5 8.5 3.5-2 3.5 2-1.3 4h-4.4l-1.3-4ZM9.8 12.5 7 16m7.2-3.5L17 16M12 6.5V3m-5 13 2.8 3m4.4 0L17 16" />
      </svg>
    )
  }

  if (name === 'trophy') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M8 4h8v4a4 4 0 0 1-8 0V4ZM10 14h4v4h3v2H7v-2h3v-4Z" />
        <path {...common} d="M8 6H5a3 3 0 0 0 3 5M16 6h3a3 3 0 0 1-3 5" />
      </svg>
    )
  }

  if (name === 'shield') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M12 3 19 6v5c0 4.4-2.7 7.5-7 10-4.3-2.5-7-5.6-7-10V6l7-3Z" />
      </svg>
    )
  }

  if (name === 'table') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M4 5h16v14H4zM4 10h16M9 5v14M15 5v14" />
      </svg>
    )
  }

  if (name === 'news') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M5 5h11a2 2 0 0 1 2 2v12H7a3 3 0 0 1-3-3V6a1 1 0 0 1 1-1Z" />
        <path {...common} d="M18 9h1.5v7.2A2.8 2.8 0 0 1 16.7 19M8 9h6M8 12h6M8 15h3" />
      </svg>
    )
  }

  if (name === 'chart') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M5 20V10M12 20V4M19 20v-7M3 20h18" />
      </svg>
    )
  }

  if (name === 'star') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="m12 3.5 2.6 5.25 5.8.85-4.2 4.1 1 5.8-5.2-2.75L6.8 19.5l1-5.8-4.2-4.1 5.8-.85L12 3.5Z" />
      </svg>
    )
  }

  if (name === 'search') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <circle {...common} cx="11" cy="11" r="6" />
        <path {...common} d="m16 16 4 4" />
      </svg>
    )
  }

  if (name === 'bell') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M15 17H9m9-1v-4.5a6 6 0 0 0-12 0V16l-1.5 2h15L18 16Zm-4.2 4a2 2 0 0 1-3.6 0" />
      </svg>
    )
  }

  if (name === 'more') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M5 12h.01M12 12h.01M19 12h.01" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path {...common} d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
    </svg>
  )
}

function MobileAccountSection({
  locale,
  onNavigate,
}: {
  locale: AppLocale
  onNavigate: () => void
}) {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [profile, setProfile] = useState<{ userId: string; username: string | null } | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const currentUserLabel =
    (profile && profile.userId === user?.id ? profile.username : null) ||
    (typeof user?.user_metadata?.username === 'string' && user.user_metadata.username) ||
    user?.email ||
    t(locale, 'account.myAccount')

  useEffect(() => {
    let active = true

    if (!user) {
      return () => {
        active = false
      }
    }

    profilesQuery()
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return

        if (error) {
          console.warn('[mobile-account] No se pudo cargar profiles', {
            message: error.message,
            code: error.code ?? null,
            details: error.details ?? null,
          })
          return
        }

        setProfile({
          userId: user.id,
          username: data?.username ?? null,
        })
      })
      .catch((error: unknown) => {
        if (!active) return

        console.warn('[mobile-account] Error cargando perfil', {
          message: error instanceof Error ? error.message : 'Error desconocido',
        })
      })

    return () => {
      active = false
    }
  }, [user])

  const handleLogout = () => {
    setError('')

    startTransition(async () => {
      try {
        getSupabaseBrowserClient()
      } catch (error) {
        setError(error instanceof Error ? error.message : t(locale, 'account.supabaseMissing'))
        return
      }

      const { error: signOutError } = await signOut()

      if (signOutError) {
        setError(t(locale, 'account.signOutError'))
        return
      }

      setProfile(null)
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
          {t(locale, 'account.myAccount')}
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
                  className="block truncate rounded-xl bg-white/[0.04] px-2.5 py-2 text-sm font-black !text-[#e4ebf3] transition hover:bg-[#70ff9d]/10 hover:!text-white"
                >
                  {currentUserLabel}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isPending}
                  className="block w-full rounded-xl px-2.5 py-2 text-left text-sm font-semibold text-[#e6edf5] transition hover:bg-[#70ff9d]/10 hover:text-white disabled:cursor-wait disabled:opacity-70"
                >
                  {isPending ? t(locale, 'account.signingOut') : t(locale, 'account.signOut')}
                </button>
                {error ? <p className="px-2.5 text-xs text-[#ffd5d5]">{error}</p> : null}
              </>
            ) : (
              <>
                <p className="rounded-xl bg-white/[0.03] px-2.5 py-2 text-sm font-semibold text-[#bcc6d2]">
                  {t(locale, 'account.notSignedIn')}
                </p>
                <Link
                  href="/login"
                  onClick={onNavigate}
                  className="mt-2 flex min-h-11 items-center justify-center rounded-xl border border-[#70ff9d]/45 bg-[#70ff9d] px-3 py-2 text-sm font-black text-[#041008] shadow-[0_12px_28px_rgba(33,212,111,0.22)] transition hover:brightness-105"
                >
                  {t(locale, 'account.signIn')}
                </Link>
                <Link
                  href="/register"
                  onClick={onNavigate}
                  className="flex min-h-11 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-sm font-bold text-[#e4ebf3] transition hover:border-[#70ff9d]/25 hover:bg-[#70ff9d]/10 hover:text-white"
                >
                  {t(locale, 'account.createAccount')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AppShell({ auth, children, locale }: AppShellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const pathname = usePathname()
  const { user } = useAuth()
  const isHome = pathname === '/'
  const isAdmin = pathname?.startsWith('/admin') ?? false
  const isProdeRoute = pathname?.startsWith('/prode') ?? false
  const isStandaloneExperience = false
  const allowAds = shouldAllowAdsOnRoute(pathname || '/')

  useEffect(() => {
    if (!isOpen || isStandaloneExperience) {
      if (isStandaloneExperience) document.body.style.overflow = ''
      return
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeydown)

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeydown)
    }
  }, [isOpen, isStandaloneExperience])

  if (isAdmin) {
    return (
      <LocaleProvider locale={locale}>
        <main className="mx-auto w-full max-w-7xl px-2 py-4 sm:px-4 md:px-5 md:py-6">
          {children}
        </main>
        <SiteFooter locale={locale} />
      </LocaleProvider>
    )
  }

  const sidebar = (
    <SidebarNav
      sections={SIDEBAR_SECTION_CONFIGS}
      locale={locale}
      compact
      onNavigate={() => setIsOpen(false)}
    />
  )
  const isPrimaryActive = (item: (typeof PRIMARY_NAV_ITEMS)[number]) => {
    if (item.key === 'home') return pathname === '/'
    if (item.key === 'news') return pathname?.startsWith('/noticias') ?? false
    if (item.key === 'competitions') return pathname === '/competiciones' || (pathname?.startsWith('/seccion') ?? false)
    if (item.key === 'teams') return pathname?.startsWith('/equipos') ?? false
    if (item.key === 'prode') return pathname?.startsWith('/prode') ?? false
    if (item.key === 'mi-torneito') return pathname?.startsWith('/mi-torneito') ?? false
    if (item.key === 'stats') return pathname?.startsWith('/estadisticas') ?? false
    if (item.key === 'favorites') return false

    return pathname === item.href
  }

  return (
    <LocaleProvider locale={locale}>
      <AppAudioPreferenceBridge />
      <TournamentAudioController />
      <div className="hf-global-shell">
        <aside className="hf-global-sidebar sidebar-scroll hidden lg:flex">
          <Link href="/" aria-label={t(locale, 'shell.homeLabel')} className="hf-global-logo">
            <BrandMark compact />
          </Link>

          <nav aria-label="Navegacion principal" className="hf-primary-nav">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const active = isPrimaryActive(item)

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={active ? 'is-active' : ''}
                  aria-current={active ? 'page' : undefined}
                >
                  <ShellIcon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="hf-my-team">
            <span>MI EQUIPO</span>
            <FavoriteTeamsList compact onOpenSearch={() => setIsSearchOpen(true)} />
          </div>

          <div id="favoritos" className="hf-sidebar-tree">
            <p className="hf-sidebar-tree-title">Competiciones</p>
            {sidebar}
          </div>

          <div className="hf-sidebar-promo">
            <strong>TU PASION.<br />TODOS LOS DIAS.</strong>
            <p>Resultados, estadisticas y todo el futbol, donde sea que estes.</p>
          </div>
        </aside>

        <div className="hf-global-main">
          {!isProdeRoute ? (
            <header className="hf-global-header">
              <Link
                href="/"
                className="hf-global-mobile-brand lg:hidden"
                aria-label={t(locale, 'shell.homeLabel')}
              >
                <BrandMark />
              </Link>

              <div className="hidden min-w-0 items-center gap-3 lg:flex">
                {isHome ? null : <BackButton />}
              </div>

              <div className="hf-global-header-actions">
                {HEADER_ACTIONS.map((action) => (
                  <Link
                    key={action.key}
                    href={action.href}
                    className={getHeaderActionClassName(action.accent)}
                  >
                    {action.label}
                  </Link>
                ))}
                <button
                  type="button"
                  className="hf-global-icon-button"
                  aria-label="Buscar"
                  onClick={() => setIsSearchOpen(true)}
                >
                  <ShellIcon name="search" />
                </button>
                <NotificationBell />
                <div className="hidden lg:block">{auth}</div>
              </div>
            </header>
          ) : null}

          <div className="hf-global-content">
            {children}
            {allowAds ? <GoogleAdSlot className="mt-4" /> : null}
          </div>
          <SiteFooter locale={locale} />
        </div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label={t(locale, 'shell.closeOverlay')}
            onClick={() => setIsOpen(false)}
          />
          <aside className="hf-mobile-drawer">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
              <Link href="/" aria-label={t(locale, 'shell.homeLabel')} onClick={() => setIsOpen(false)}>
                <BrandMark compact />
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-base font-bold text-white transition hover:bg-white/[0.1]"
                aria-label={t(locale, 'shell.closeMenu')}
              >
                x
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <nav aria-label="Navegacion principal" className="mb-2 grid gap-1">
                {PRIMARY_NAV_ITEMS.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-black text-white transition hover:bg-white/10"
                  >
                    <ShellIcon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
              {sidebar}
              <div className="mt-2">
                <MobileAccountSection locale={locale} onNavigate={() => setIsOpen(false)} />
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {isFavoritesOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Cerrar favoritos"
            onClick={() => setIsFavoritesOpen(false)}
          />
          <div className="hf-mobile-favorites-panel">
            <div className="hf-mobile-favorites-head">
              <strong>Favoritos</strong>
              <button type="button" onClick={() => setIsFavoritesOpen(false)} aria-label="Cerrar favoritos">
                x
              </button>
            </div>
            <FavoriteTeamsList
              onOpenSearch={() => {
                setIsFavoritesOpen(false)
                setIsSearchOpen(true)
              }}
            />
          </div>
        </div>
      ) : null}

      {isMoreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Cerrar mas opciones"
            onClick={() => setIsMoreOpen(false)}
          />
          <div className="hf-mobile-favorites-panel hf-mobile-more-panel">
            <div className="hf-mobile-favorites-head">
              <strong>Mas secciones</strong>
              <button type="button" onClick={() => setIsMoreOpen(false)} aria-label="Cerrar mas opciones">
                x
              </button>
            </div>
            <div className="hf-mobile-more-list">
              {MOBILE_MORE_ITEMS.map((item) => (
                <Link
                  key={item.key}
                  href={item.needsAuthRoute ? (user ? '/perfil' : '/login') : item.href}
                  onClick={() => setIsMoreOpen(false)}
                >
                  <ShellIcon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <nav className="hf-mobile-bottom-nav lg:hidden" aria-label="Navegacion principal mobile">
        {MOBILE_BOTTOM_ITEMS.map((item) => {
          const active =
            item.key === 'home'
              ? pathname === '/'
              : item.key === 'competitions'
                ? pathname === '/competiciones' || (pathname?.startsWith('/seccion') ?? false)
                : item.key === 'prode'
                  ? pathname?.startsWith('/prode')
                : item.key === 'more'
                  ? isMoreOpen
                  : false

          if (item.opensFavorites) {
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setIsMoreOpen(false)
                  setIsFavoritesOpen(true)
                }}
                aria-label="Abrir favoritos"
              >
                <ShellIcon name={item.icon} />
                <span>{item.label}</span>
              </button>
            )
          }

          if (item.opensMore) {
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setIsFavoritesOpen(false)
                  setIsMoreOpen(true)
                }}
                aria-label="Abrir mas secciones"
                className={active ? 'is-active' : ''}
              >
                <ShellIcon name={item.icon} />
                <span>{item.label}</span>
              </button>
            )
          }

          return (
            <Link
              key={item.key}
              href={item.href || '/'}
              className={active ? 'is-active' : ''}
              aria-current={active ? 'page' : undefined}
            >
              <ShellIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <GlobalSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </LocaleProvider>
  )
}
