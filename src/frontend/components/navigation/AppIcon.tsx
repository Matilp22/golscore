export type AppIconName =
  | 'home'
  | 'matches'
  | 'search'
  | 'star'
  | 'more'
  | 'competitions'
  | 'world'
  | 'news'
  | 'prode'
  | 'tournament'
  | 'teams'
  | 'stats'
  | 'transfers'
  | 'profile'
  | 'logout'
  | 'chevronRight'
  | 'close'
  | 'info'

type AppIconProps = {
  name: AppIconName
  className?: string
}

export default function AppIcon({
  name,
  className = 'h-5 w-5',
}: AppIconProps) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.9,
  }

  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    )
  }

  if (name === 'matches') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <circle {...common} cx="12" cy="12" r="8.5" />
        <path {...common} d="m8.6 8.7 3.4-2 3.4 2-1.3 3.9H9.9L8.6 8.7Zm1.3 3.9L7.2 16m6.9-3.4 2.7 3.4M12 6.7V3.5M7.2 16l2.7 3m4.2 0 2.7-3" />
      </svg>
    )
  }

  if (name === 'search') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <circle {...common} cx="10.8" cy="10.8" r="6.3" />
        <path {...common} d="m15.5 15.5 4.2 4.2" />
      </svg>
    )
  }

  if (name === 'star') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="m12 3.7 2.55 5.17 5.7.83-4.12 4.02.97 5.68-5.1-2.68-5.1 2.68.97-5.68L3.75 9.7l5.7-.83L12 3.7Z" />
      </svg>
    )
  }

  if (name === 'more') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
        <circle cx="18.5" cy="12" r="1.2" fill="currentColor" />
      </svg>
    )
  }

  if (name === 'competitions' || name === 'prode') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M8 4h8v4a4 4 0 0 1-8 0V4Zm2 10h4v4h3v2H7v-2h3v-4Z" />
        <path {...common} d="M8 6H5a3 3 0 0 0 3 5m8-5h3a3 3 0 0 1-3 5" />
      </svg>
    )
  }

  if (name === 'world') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <circle {...common} cx="12" cy="12" r="9" />
        <path {...common} d="M3.4 12h17.2M12 3c2.4 2.4 3.7 5.4 3.7 9s-1.3 6.6-3.7 9c-2.4-2.4-3.7-5.4-3.7-9S9.6 5.4 12 3Z" />
      </svg>
    )
  }

  if (name === 'news') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M5 5h11a2 2 0 0 1 2 2v12H7a3 3 0 0 1-3-3V6a1 1 0 0 1 1-1Z" />
        <path {...common} d="M18 9h1.5v7.2A2.8 2.8 0 0 1 16.7 19M8 9h6m-6 3h6m-6 3h3" />
      </svg>
    )
  }

  if (name === 'tournament') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <rect {...common} x="4" y="5" width="16" height="15" rx="2" />
        <path {...common} d="M8 3v4m8-4v4M4 10h16m-12 4h3m2 0h3m-8 3h3" />
      </svg>
    )
  }

  if (name === 'teams') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M12 3 19 6v5c0 4.4-2.7 7.5-7 10-4.3-2.5-7-5.6-7-10V6l7-3Z" />
      </svg>
    )
  }

  if (name === 'stats') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M5 20V10m7 10V4m7 16v-7M3 20h18" />
      </svg>
    )
  }

  if (name === 'transfers') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M5 8h14m0 0-3-3m3 3-3 3M19 16H5m0 0 3 3m-3-3 3-3" />
      </svg>
    )
  }

  if (name === 'logout') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" />
      </svg>
    )
  }

  if (name === 'chevronRight') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="m9 5 7 7-7 7" />
      </svg>
    )
  }

  if (name === 'close') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path {...common} d="m6 6 12 12M18 6 6 18" />
      </svg>
    )
  }

  if (name === 'info') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <circle {...common} cx="12" cy="12" r="9" />
        <path {...common} d="M12 11v6m0-10v.2" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path {...common} d="M20 21a8 8 0 0 0-16 0m8-8a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
    </svg>
  )
}
