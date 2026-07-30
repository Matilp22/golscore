type MatchDetailNavigationItem = {
  href: string
  label: string
  detail?: string
}

export default function MatchDetailNavigation({
  items,
}: {
  items: MatchDetailNavigationItem[]
}) {
  return (
    <nav className="hf-match-detail-nav" aria-label="Secciones del partido">
      {items.map((item) => (
        <a key={item.href} href={item.href}>
          <span>{item.label}</span>
          {item.detail ? <small>{item.detail}</small> : null}
        </a>
      ))}
    </nav>
  )
}
