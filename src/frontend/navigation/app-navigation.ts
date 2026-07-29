import type { AppIconName } from '@/frontend/components/navigation/AppIcon'

export type AppNavigationItem = {
  key: string
  label: string
  href: string
  icon: AppIconName
}

export const DESKTOP_NAVIGATION: AppNavigationItem[] = [
  { key: 'matches', label: 'Partidos', href: '/#partidos', icon: 'matches' },
  { key: 'competitions', label: 'Competiciones', href: '/competiciones', icon: 'competitions' },
  { key: 'world', label: 'Mundial 2026', href: '/liga/selecciones-mundial', icon: 'world' },
  { key: 'news', label: 'Noticias', href: '/noticias', icon: 'news' },
  { key: 'prode', label: 'Prode', href: '/prode', icon: 'prode' },
  { key: 'mi-torneito', label: 'Mi Torneito', href: '/mi-torneito', icon: 'tournament' },
]

export const MOBILE_NAVIGATION: Array<
  AppNavigationItem & {
    action?: 'search' | 'favorites' | 'more'
  }
> = [
  { key: 'home', label: 'Inicio', href: '/', icon: 'home' },
  { key: 'matches', label: 'Partidos', href: '/#partidos', icon: 'matches' },
  { key: 'search', label: 'Buscar', href: '#buscar', icon: 'search', action: 'search' },
  { key: 'favorites', label: 'Favoritos', href: '#favoritos', icon: 'star', action: 'favorites' },
  { key: 'more', label: 'Más', href: '#mas', icon: 'more', action: 'more' },
]

export const MORE_NAVIGATION: AppNavigationItem[] = [
  { key: 'competitions', label: 'Competiciones', href: '/competiciones', icon: 'competitions' },
  { key: 'world', label: 'Mundial 2026', href: '/liga/selecciones-mundial', icon: 'world' },
  { key: 'teams', label: 'Equipos y selecciones', href: '/equipos', icon: 'teams' },
  { key: 'stats', label: 'Estadísticas', href: '/estadisticas', icon: 'stats' },
  { key: 'news', label: 'Noticias', href: '/noticias', icon: 'news' },
  { key: 'transfers', label: 'Mercado de pases', href: '/mercado-de-pases', icon: 'transfers' },
  { key: 'prode', label: 'Prode', href: '/prode', icon: 'prode' },
  { key: 'mi-torneito', label: 'Mi Torneito', href: '/mi-torneito', icon: 'tournament' },
]

export function isNavigationItemActive(
  pathname: string | null,
  item: AppNavigationItem
) {
  if (!pathname) return false
  if (item.key === 'home') return pathname === '/'
  if (item.key === 'matches') return false
  if (item.key === 'competitions') {
    return pathname === '/competiciones' || pathname.startsWith('/seccion/')
  }
  if (item.key === 'world') return pathname === '/liga/selecciones-mundial'
  if (item.key === 'teams') {
    return pathname === '/equipos' || pathname.startsWith('/equipo/')
  }
  if (item.key === 'stats') return pathname === '/estadisticas'
  if (item.key === 'news') return pathname.startsWith('/noticias')
  if (item.key === 'transfers') return pathname.startsWith('/mercado-de-pases')
  if (item.key === 'prode') return pathname.startsWith('/prode')
  if (item.key === 'mi-torneito') return pathname.startsWith('/mi-torneito')

  return pathname === item.href
}
