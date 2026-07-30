'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const adminLinks = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/sync', label: 'Sincronización' },
  { href: '/admin/matches', label: 'Partidos' },
  { href: '/admin/mi-torneito', label: 'Mi Torneito' },
  { href: '/admin/featured-matches', label: 'Destacados' },
  { href: '/admin/broadcasts', label: 'TV' },
  { href: '/admin/ads', label: 'Publicidad' },
  { href: '/admin/visibility', label: 'Visibilidad' },
] as const

type AdminSidebarProps = {
  orientation?: 'vertical' | 'horizontal' | 'grid'
}

export default function AdminSidebar({
  orientation = 'vertical',
}: AdminSidebarProps) {
  const pathname = usePathname()
  const navClassName =
    orientation === 'horizontal'
      ? 'hf-admin-nav is-horizontal'
      : orientation === 'grid'
        ? 'hf-admin-nav is-grid'
        : 'hf-admin-nav'

  return (
    <nav className={navClassName} aria-label="Administración">
      {adminLinks.map((link) => {
        const isCurrent =
          link.href === '/admin'
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`)

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isCurrent ? 'page' : undefined}
          >
            <span aria-hidden="true" />
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
