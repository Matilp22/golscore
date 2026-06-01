import type { ReactNode } from 'react'
import { buildNoIndexMetadata } from '@/shared/seo'

export const metadata = buildNoIndexMetadata(
  'Prueba Frontend Sentry | Hay Fulbo',
  'Página técnica para probar errores frontend de Sentry.',
  '/sentry-test'
)

export default function SentryTestLayout({ children }: { children: ReactNode }) {
  return children
}
