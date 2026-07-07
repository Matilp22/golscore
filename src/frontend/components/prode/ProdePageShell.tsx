'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { useState } from 'react'
import GlobalSearch from '@/frontend/components/global/GlobalSearch'

type ProdePageShellProps = {
  title: string
  subtitle: string
  eyebrow?: string
  children: ReactNode
  action?: {
    href: string
    label: string
    variant?: 'primary' | 'secondary'
  }
  secondaryAction?: {
    href: string
    label: string
  }
}

type IconName =
  | 'home'
  | 'live'
  | 'calendar'
  | 'chart'
  | 'shield'
  | 'trophy'
  | 'search'
  | 'menu'
  | 'more'
type ProdeNavItem = { label: string; href: string; icon: IconName; active?: boolean }

const HF_LOGO_SRC = '/brand/hf-logo.png'

const prodeNavItems: ProdeNavItem[] = [
  { label: 'Inicio', href: '/', icon: 'home' },
  { label: 'Competiciones', href: '/competiciones', icon: 'trophy' },
  { label: 'En vivo', href: '/#en-vivo', icon: 'live' },
  { label: 'Proximos', href: '/#proximos', icon: 'calendar' },
  { label: 'Posiciones', href: '/liga/selecciones-mundial#posiciones', icon: 'chart' },
  { label: 'Equipos', href: '/liga/selecciones-mundial#mundial-grupos', icon: 'shield' },
  { label: 'Prode', href: '/prode', icon: 'trophy', active: true },
]

function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
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
        <path {...common} d="M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.4Z" />
      </svg>
    )
  }

  if (name === 'live') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M8 8.5a5 5 0 0 0 0 7M16 8.5a5 5 0 0 1 0 7M5 5a9.6 9.6 0 0 0 0 14M19 5a9.6 9.6 0 0 1 0 14" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      </svg>
    )
  }

  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
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

  if (name === 'shield') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M12 3 19 6v5c0 4.4-2.7 7.5-7 10-4.3-2.5-7-5.6-7-10V6l7-3Z" />
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

  if (name === 'search') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <circle {...common} cx="11" cy="11" r="6" />
        <path {...common} d="m16 16 4 4" />
      </svg>
    )
  }

  if (name === 'menu') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path {...common} d="M5 12h.01M12 12h.01M19 12h.01" />
    </svg>
  )
}

export default function ProdePageShell({
  title,
  subtitle,
  eyebrow = 'Prode Mundial',
  children,
  action,
  secondaryAction,
}: ProdePageShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  return (
    <div className="hf-prode-shell">
      <main className="hf-prode-main">
        <header className="hf-prode-header">
          <button
            type="button"
            className="hf-prode-icon-button lg:hidden"
            aria-label="Abrir menu"
            onClick={() => setIsMenuOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <Link href="/" className="hf-prode-mobile-logo lg:hidden" aria-label="Hay Fulbo inicio">
            <Image src={HF_LOGO_SRC} alt="Hay Fulbo" width={134} height={91} priority className="h-auto w-[82px]" />
          </Link>
          <Link href="/" className="hidden items-center gap-4 lg:flex" aria-label="Hay Fulbo inicio">
            <Image src={HF_LOGO_SRC} alt="Hay Fulbo" width={134} height={91} priority className="h-auto w-[58px]" />
            <span className="text-2xl font-black text-[var(--hf-prode-navy)]">HAY FULBO</span>
          </Link>
          <div className="hidden flex-1 justify-center lg:flex">
            <span className="hf-prode-pill is-active">Prode</span>
            <Link href="/prode/torneos" className="hf-prode-pill">Torneos</Link>
            <Link href="/liga/selecciones-mundial" className="hf-prode-pill">Mundial</Link>
          </div>
          <button
            type="button"
            className="hf-prode-icon-button"
            aria-label="Buscar"
            onClick={() => setIsSearchOpen(true)}
          >
            <Icon name="search" />
          </button>
        </header>

        <section className="hf-prode-hero">
          <div className="relative z-10 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--hf-prode-green)]">{eyebrow}</p>
            <h1 className="mt-2 text-4xl font-black leading-none text-white md:text-6xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/76 md:text-base">{subtitle}</p>
            {(action || secondaryAction) ? (
              <div className="mt-5 flex flex-wrap gap-3">
                {action ? (
                  <Link href={action.href} className={action.variant === 'secondary' ? 'hf-prode-button-secondary' : 'hf-prode-button'}>
                    {action.label}
                  </Link>
                ) : null}
                {secondaryAction ? (
                  <Link href={secondaryAction.href} className="hf-prode-button-secondary">
                    {secondaryAction.label}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="hf-prode-hero-number" aria-hidden="true">3</div>
          <div className="hf-prode-hero-brush" aria-hidden="true" />
        </section>

        <div className="hf-prode-content">
          {children}
        </div>
      </main>

      {isMenuOpen ? (
        <div className="hf-prode-mobile-menu lg:hidden">
          <button
            type="button"
            className="hf-prode-mobile-menu-backdrop"
            aria-label="Cerrar menu"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="hf-prode-mobile-menu-panel">
            <div className="hf-prode-mobile-menu-head">
              <Image src={HF_LOGO_SRC} alt="Hay Fulbo" width={134} height={91} priority className="h-auto w-[86px]" />
              <button type="button" onClick={() => setIsMenuOpen(false)} aria-label="Cerrar menu">
                x
              </button>
            </div>
            <nav aria-label="Menu Prode mobile">
              {prodeNavItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={item.active ? 'is-active' : ''}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Icon name={item.icon} className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <GlobalSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </div>
  )
}
