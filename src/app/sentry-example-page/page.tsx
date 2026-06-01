import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { buildNoIndexMetadata } from '@/shared/seo'
import SentryExampleClient from './SentryExampleClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildNoIndexMetadata(
  'Prueba de Sentry | Hay Fulbo',
  'Página técnica de prueba para monitoreo de errores.',
  '/sentry-example-page'
)

export default function SentryExamplePage() {
  if (process.env.SENTRY_TEST_ENABLED !== 'true') {
    notFound()
  }

  return <SentryExampleClient />
}
