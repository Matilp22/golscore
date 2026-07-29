'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from 'react'

import AppAudioPreferenceBridge from '@/frontend/components/AppAudioPreferenceBridge'
import BackButton from '@/frontend/components/BackButton'
import BrandMark from '@/frontend/components/BrandMark'
import FavoriteTeamsList from '@/frontend/components/favorites/FavoriteTeamsList'
import GlobalSearch from '@/frontend/components/global/GlobalSearch'
import NotificationBell from '@/frontend/components/global/NotificationBell'
import { LocaleProvider } from '@/frontend/components/LocaleProvider'
import AppIcon from '@/frontend/components/navigation/AppIcon'
import MobileSheet from '@/frontend/components/overlays/MobileSheet'
import SiteFooter from '@/frontend/components/SiteFooter'
import SidebarNav from '@/frontend/components/SidebarNav'
import GoogleAdSlot from '@/frontend/components/ads/GoogleAdSlot'
import TournamentAudioController from '@/frontend/components/TournamentAudioController'
import { useAuth } from '@/frontend/hooks/useAuth'
import { useGlobalActionsData } from '@/frontend/hooks/useGlobalActionsData'
import {
  DESKTOP_NAVIGATION,
  MOBILE_NAVIGATION,
  MORE_NAVIGATION,
  isNavigationItemActive,
} from '@/frontend/navigation/app-navigation'
import { getSupabaseBrowserClient, signOut } from '@/lib/supabase/supabaseClient'
import { SIDEBAR_SECTION_CONFIGS } from '@/lib/tournament-pages'
import { shouldAllowAdsOnRoute } from '@/shared/content-quality'
import { isLiveStatus } from '@/shared/utils/match-status'
import type { AppLocale } from '@/shared/i18n/locales'

type AppShellProps = {
  auth: ReactNode
  children: ReactNode
  locale: AppLocale
}

function LiveNowLink() {
  const { data } = useGlobalActionsData(true)
  const liveCount =
    data?.matches.filter((match) => isLiveStatus(match.statusShort)).length ?? 0

  if (liveCount === 0) return null

  return (
    <Link href="/#partidos" className="hf-live-now-link">
      <span aria-hidden="true" />
      <strong>En vivo</strong>
      <small>{liveCount}</small>
      <span className="hf-sr-only">
        {liveCount === 1 ? '1 partido en vivo' : `${liveCount} partidos en vivo`}
      </span>
    </Link>
  )
}

function SearchTrigger({
  compact = false,
  onOpen,
}: {
  compact?: boolean
  onOpen: () => void
}) {
  if (compact) {
    return (
      <button
        type="button"
        className="hf-shell-icon-action"
        aria-label="Buscar en Hay Fulbo"
        onClick={onOpen}
      >
        <AppIcon name="search" />
      </button>
    )
  }

  return (
    <button
      type="button"
      className="hf-shell-search-trigger"
      onClick={onOpen}
      aria-label="Buscar equipos, partidos, jugadores y noticias"
    >
      <AppIcon name="search" />
      <span>Buscar en Hay Fulbo</span>
      <kbd>Ctrl K</kbd>
    </button>
  )
}

function MobileAccountLinks({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      try {
        getSupabaseBrowserClient()
      } catch {
        return
      }

      const { error } = await signOut()
      if (error) return

      onNavigate()
      router.replace('/')
      router.refresh()
    })
  }

  if (isLoading) {
    return (
      <div className="hf-sheet-account-skeleton" aria-label="Cargando sesión">
        <span />
        <span />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="hf-sheet-account">
        <div>
          <span className="hf-type-overline">Tu cuenta</span>
          <p>Guardá tu Prode y accedé a torneos privados.</p>
        </div>
        <div className="hf-sheet-account-actions">
          <Link href="/login" onClick={onNavigate}>
            Iniciar sesión
          </Link>
          <Link href="/register" onClick={onNavigate}>
            Crear cuenta
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="hf-sheet-account">
      <div>
        <span className="hf-type-overline">Sesión activa</span>
        <p>{user.email || 'Tu cuenta de Hay Fulbo'}</p>
      </div>
      <div className="hf-sheet-account-actions">
        <Link href="/perfil" onClick={onNavigate}>
          <AppIcon name="profile" />
          Perfil
        </Link>
        <button type="button" onClick={handleLogout} disabled={isPending}>
          <AppIcon name="logout" />
          {isPending ? 'Cerrando…' : 'Cerrar sesión'}
        </button>
      </div>
    </div>
  )
}

export default function AppShell({
  auth,
  children,
  locale,
}: AppShellProps) {
  const pathname = usePathname()
  const [overlay, setOverlay] = useOverlayState()
  const isAdmin = pathname?.startsWith('/admin') ?? false
  const isHome = pathname === '/'
  const allowAds = shouldAllowAdsOnRoute(pathname || '/')
  const closeOverlay = useCallback(() => setOverlay(null), [setOverlay])
  const handleSearchOpenChange = useCallback(
    (open: boolean) => setOverlay(open ? 'search' : null),
    [setOverlay]
  )

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k' || (!event.metaKey && !event.ctrlKey)) {
        return
      }

      event.preventDefault()
      setOverlay('search')
    }

    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [setOverlay])

  if (isAdmin) {
    return (
      <LocaleProvider locale={locale}>
        <main
          id="contenido-principal"
          tabIndex={-1}
          className="hf-admin-content"
        >
          {children}
        </main>
        <SiteFooter locale={locale} />
      </LocaleProvider>
    )
  }

  return (
    <LocaleProvider locale={locale}>
      <AppAudioPreferenceBridge />
      <TournamentAudioController />

      <div className="hf-global-shell">
        <header className="hf-global-header">
          <div className="hf-global-header-primary">
            <div className="hf-global-header-inner">
              <div className="hf-global-header-start">
                {!isHome ? <BackButton /> : null}
                <Link href="/" className="hf-global-brand" aria-label="Hay Fulbo, inicio">
                  <BrandMark compact />
                </Link>
              </div>

              <div className="hf-global-header-center">
                <SearchTrigger onOpen={() => setOverlay('search')} />
              </div>

              <div className="hf-global-header-end">
                <LiveNowLink />
                <SearchTrigger
                  compact
                  onOpen={() => setOverlay('search')}
                />
                <button
                  type="button"
                  className="hf-shell-icon-action hf-shell-favorites-action"
                  aria-label="Abrir equipos favoritos"
                  onClick={() => setOverlay('favorites')}
                >
                  <AppIcon name="star" />
                </button>
                <NotificationBell />
                <div className="hf-global-auth">{auth}</div>
              </div>
            </div>
          </div>

          <nav
            className="hf-global-nav"
            aria-label="Navegación principal"
          >
            <div className="hf-global-nav-inner">
              {DESKTOP_NAVIGATION.map((item) => {
                const active =
                  item.key === 'matches'
                    ? pathname === '/'
                    : isNavigationItemActive(pathname, item)

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={active ? 'is-active' : ''}
                    aria-current={active ? 'page' : undefined}
                  >
                    <AppIcon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </nav>
        </header>

        <div className="hf-global-main">
          <div
            id="contenido-principal"
            tabIndex={-1}
            className="hf-global-content"
          >
            {children}
            {allowAds ? <GoogleAdSlot className="hf-global-ad-slot" /> : null}
          </div>
          <SiteFooter locale={locale} />
        </div>
      </div>

      <nav
        className="hf-mobile-bottom-nav"
        aria-label="Navegación principal mobile"
      >
        {MOBILE_NAVIGATION.map((item) => {
          const active =
            item.action === 'search'
              ? overlay === 'search'
              : item.action === 'favorites'
                ? overlay === 'favorites'
                : item.action === 'more'
                  ? overlay === 'more'
                  : isNavigationItemActive(pathname, item)

          if (item.action) {
            return (
              <button
                key={item.key}
                type="button"
                className={active ? 'is-active' : ''}
                aria-label={`${item.label} en Hay Fulbo`}
                aria-pressed={active}
                onClick={() => setOverlay(item.action || null)}
              >
                <AppIcon name={item.icon} />
                <span>{item.label}</span>
              </button>
            )
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              className={active ? 'is-active' : ''}
              aria-current={active ? 'page' : undefined}
            >
              <AppIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <MobileSheet
        open={overlay === 'favorites'}
        title="Tus equipos"
        onClose={closeOverlay}
      >
        <FavoriteTeamsList
          onOpenSearch={() => setOverlay('search')}
        />
      </MobileSheet>

      <MobileSheet
        open={overlay === 'more'}
        title="Explorar Hay Fulbo"
        onClose={closeOverlay}
        className="hf-more-sheet"
      >
        <nav className="hf-more-navigation" aria-label="Más secciones">
          {MORE_NAVIGATION.map((item) => {
            const active = isNavigationItemActive(pathname, item)

            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={closeOverlay}
                className={active ? 'is-active' : ''}
                aria-current={active ? 'page' : undefined}
              >
                <AppIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <MobileAccountLinks onNavigate={closeOverlay} />

        <section className="hf-more-competitions">
          <div>
            <span className="hf-type-overline">Por región</span>
            <h3>Competiciones</h3>
          </div>
          <SidebarNav
            sections={SIDEBAR_SECTION_CONFIGS}
            locale={locale}
            compact
            showEditorial={false}
            onNavigate={closeOverlay}
          />
        </section>
      </MobileSheet>

      <GlobalSearch
        open={overlay === 'search'}
        onOpenChange={handleSearchOpenChange}
      />
    </LocaleProvider>
  )
}

type OverlayName = 'search' | 'favorites' | 'more' | null

function useOverlayState() {
  const [overlay, setOverlay] = useState<OverlayName>(null)

  return [overlay, setOverlay] as const
}
