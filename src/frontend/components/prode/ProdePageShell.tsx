import Link from 'next/link'
import type { ReactNode } from 'react'

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

const PRODE_CONTEXT_LINKS = [
  { href: '/prode', label: 'Pronósticos' },
  { href: '/prode/torneos', label: 'Torneos privados' },
  { href: '/liga/selecciones-mundial', label: 'Mundial 2026' },
]

export default function ProdePageShell({
  title,
  subtitle,
  eyebrow = 'Prode Hay Fulbo',
  children,
  action,
  secondaryAction,
}: ProdePageShellProps) {
  return (
    <main className="hf-prode-shell">
      <header className="hf-prode-matchday-hero">
        <div className="hf-prode-matchday-copy">
          <span className="hf-type-overline">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
          {action || secondaryAction ? (
            <div className="hf-prode-matchday-actions">
              {action ? (
                <Link
                  href={action.href}
                  className={action.variant === 'secondary' ? 'is-secondary' : ''}
                >
                  {action.label}
                </Link>
              ) : null}
              {secondaryAction ? (
                <Link href={secondaryAction.href} className="is-secondary">
                  {secondaryAction.label}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="hf-prode-matchday-rule" aria-label="Puntaje principal">
          <span>Resultado exacto</span>
          <strong>3</strong>
          <small>puntos por acertar el marcador</small>
        </div>
      </header>

      <nav className="hf-prode-context-nav" aria-label="Secciones del Prode">
        {PRODE_CONTEXT_LINKS.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="hf-prode-content">{children}</div>
    </main>
  )
}
