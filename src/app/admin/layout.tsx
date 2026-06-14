import type { ReactNode } from 'react'
import { buildNoIndexMetadata } from '@/shared/seo'

export const metadata = buildNoIndexMetadata(
  'Admin | Hay Fulbo',
  'Panel privado de administracion de Hay Fulbo.',
  '/admin'
)

export default function AdminRootLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
