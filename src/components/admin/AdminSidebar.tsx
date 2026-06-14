import Link from 'next/link'

const adminLinks = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/sync', label: 'Sync' },
  { href: '/admin/matches', label: 'Partidos' },
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
  const navClassName =
    orientation === 'horizontal'
      ? 'flex gap-1'
      : orientation === 'grid'
        ? 'grid grid-cols-2 gap-2'
        : 'space-y-1'

  return (
    <nav className={navClassName}>
      {adminLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="block min-w-0 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-[#c8d0da] transition hover:bg-[#70ff9d]/10 hover:text-white"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
