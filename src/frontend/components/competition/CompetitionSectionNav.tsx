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
      {items.map((item) => (
        <a key={item.key} href={item.href} className={item.active ? 'is-active' : ''}>
          {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
          <span>{item.label}</span>
        </a>
      ))}

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
