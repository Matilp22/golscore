import type { ReactNode } from 'react'

export type CompetitionSectionNavItem = {
  key: string
  label: string
  href: string
  icon?: ReactNode
  active?: boolean
}

type CompetitionSectionNavProps = {
  label: string
  items: CompetitionSectionNavItem[]
  moreItems?: CompetitionSectionNavItem[]
  variant?: 'tabs' | 'quick'
  className?: string
}

type DefaultSectionIconName =
  | 'calendar'
  | 'table'
  | 'bracket'
  | 'chart'
  | 'shield'
  | 'trophy'
  | 'more'

function getDefaultSectionIconName(item: CompetitionSectionNavItem): DefaultSectionIconName {
  const value = `${item.key} ${item.label}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (value.includes('llave') || value.includes('bracket') || value.includes('eliminatoria')) {
    return 'bracket'
  }
  if (value.includes('clasificacion') || value.includes('posicion') || value.includes('tabla')) {
    return 'table'
  }
  if (value.includes('estadistica') || value.includes('goleador') || value.includes('asistencia')) {
    return 'chart'
  }
  if (value.includes('equipo') || value.includes('seleccion')) {
    return 'shield'
  }
  if (value.includes('campeon') || value.includes('prode')) {
    return 'trophy'
  }
  if (value.includes('partido') || value.includes('fixture') || value.includes('agenda')) {
    return 'calendar'
  }

  return 'more'
}

function DefaultSectionIcon({ name }: { name: DefaultSectionIconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
  }

  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 24 24">
        <path {...common} d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
        <path {...common} d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" />
      </svg>
    )
  }

  if (name === 'table') {
    return (
      <svg viewBox="0 0 24 24">
        <path {...common} d="M5 4h14a1 1 0 0 1 1 1v14H4V5a1 1 0 0 1 1-1Z" />
        <path {...common} d="M4 10h16M4 15h16M9 4v15M15 4v15" />
      </svg>
    )
  }

  if (name === 'bracket') {
    return (
      <svg viewBox="0 0 24 24">
        <path {...common} d="M6 5h5v5H6zM6 14h5v5H6zM13 7.5h3a2 2 0 0 1 2 2V12M13 16.5h3a2 2 0 0 0 2-2V12M18 12h2" />
      </svg>
    )
  }

  if (name === 'chart') {
    return (
      <svg viewBox="0 0 24 24">
        <path {...common} d="M5 20V10M12 20V4M19 20v-7M3 20h18" />
      </svg>
    )
  }

  if (name === 'shield') {
    return (
      <svg viewBox="0 0 24 24">
        <path {...common} d="M12 3 19 6v5c0 4.4-2.7 7.5-7 10-4.3-2.5-7-5.6-7-10V6l7-3Z" />
      </svg>
    )
  }

  if (name === 'trophy') {
    return (
      <svg viewBox="0 0 24 24">
        <path {...common} d="M8 4h8v4a4 4 0 0 1-8 0V4ZM10 14h4v4h3v2H7v-2h3v-4Z" />
        <path {...common} d="M8 6H5a3 3 0 0 0 3 5M16 6h3a3 3 0 0 1-3 5" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24">
      <path {...common} d="M5 12h.01M12 12h.01M19 12h.01" />
    </svg>
  )
}

export default function CompetitionSectionNav({
  label,
  items,
  moreItems = [],
  variant = 'tabs',
  className = '',
}: CompetitionSectionNavProps) {
  const rootClassName = [
    'hf-competition-section-nav',
    variant === 'quick' ? 'is-quick' : 'is-tabs',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <nav className={rootClassName} aria-label={label}>
      {items.map((item) => {
        const icon = item.icon ?? (variant === 'quick' ? (
          <DefaultSectionIcon name={getDefaultSectionIconName(item)} />
        ) : null)

        return (
          <a key={item.key} href={item.href} className={item.active ? 'is-active' : ''}>
            {icon ? <span className="hf-competition-section-icon" aria-hidden="true">{icon}</span> : null}
            <span>{item.label}</span>
          </a>
        )
      })}

      {moreItems.length ? (
        <details className="hf-competition-section-more">
          <summary>
            <span aria-hidden="true">...</span>
            <span>Mas</span>
          </summary>
          <div>
            {moreItems.map((item) => (
              <a key={item.key} href={item.href}>
                {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        </details>
      ) : null}
    </nav>
  )
}
