import Link from 'next/link'

const adminLinks = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/sync', label: 'Sync' },
  { href: '/admin/featured-matches', label: 'Destacados' },
  { href: '/admin/broadcasts', label: 'TV' },
  { href: '/admin/ads', label: 'Publicidad' },
  { href: '/admin/visibility', label: 'Visibilidad' },
] as const

type AdminSidebarProps = {
  orientation?: 'vertical' | 'horizontal'
}

export default function AdminSidebar({
  orientation = 'vertical',
}: AdminSidebarProps) {
  return (
    <nav className={orientation === 'horizontal' ? 'flex gap-1' : 'space-y-1'}>
      {adminLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="block whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-[#c8d0da] transition hover:bg-[#70ff9d]/10 hover:text-white"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
