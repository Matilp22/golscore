import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import AppShell from '@/frontend/components/AppShell'
import PwaInstallPrompt from '@/frontend/components/PwaInstallPrompt'
import AuthStatus from '@/frontend/components/auth/AuthStatus'
import GoogleAdSense from '@/frontend/components/ads/GoogleAdSense'
import GoogleAnalytics from '@/frontend/components/analytics/GoogleAnalytics'
import './globals.css'

const SITE_URL = 'https://hayfulbo.com'
const SITE_DESCRIPTION =
  'Resultados de fútbol, fixtures, estadísticas, prode y contenido futbolero en Hay Fulbo.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'HAY FULBO',
    template: '%s | HAY FULBO',
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.json',
  applicationName: 'HAY FULBO',
  appleWebApp: {
    capable: true,
    title: 'HAY FULBO',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/hay-fulbo-icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/hay-fulbo-icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  },
  openGraph: {
    title: 'HAY FULBO',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: 'HAY FULBO',
    type: 'website',
    locale: 'es_AR',
  },
  twitter: {
    card: 'summary',
    title: 'HAY FULBO',
    description: SITE_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  themeColor: '#06100d',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-[#06100d] text-white">
        <AppShell auth={<AuthStatus />}>
          {children}
        </AppShell>
        <PwaInstallPrompt />
        <GoogleAdSense />
        <GoogleAnalytics />
        <Analytics />
      </body>
    </html>
  )
}
