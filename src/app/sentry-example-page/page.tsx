import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SentryExampleClient from './SentryExampleClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Prueba de Sentry',
}

export default function SentryExamplePage() {
  if (process.env.SENTRY_TEST_ENABLED !== 'true') {
    notFound()
  }

  return <SentryExampleClient />
}
