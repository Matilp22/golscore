import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import AppShell from '@/frontend/components/AppShell'
import PwaInstallPrompt from '@/frontend/components/PwaInstallPrompt'
import AuthStatus from '@/frontend/components/auth/AuthStatus'
import GoogleAdSense from '@/frontend/components/ads/GoogleAdSense'
import GoogleAnalytics from '@/frontend/components/analytics/GoogleAnalytics'
import {
  DEFAULT_SEO_DESCRIPTION,
  DEFAULT_SEO_TITLE,
  SITE_NAME,
  SITE_URL,
} from '@/shared/seo'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_SEO_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_SEO_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
  },
  manifest: '/manifest.json',
  applicationName: SITE_NAME,
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
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
    title: DEFAULT_SEO_TITLE,
    description: DEFAULT_SEO_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: 'website',
    locale: 'es_AR',
  },
  twitter: {
    card: 'summary',
    title: DEFAULT_SEO_TITLE,
    description: DEFAULT_SEO_DESCRIPTION,
  },
  other: {
    'google-adsense-account': 'ca-pub-9918770947892784',
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
