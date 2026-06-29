import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import AppShell from '@/frontend/components/AppShell'
import PageScrollRestoration from '@/frontend/components/PageScrollRestoration'
import PwaInstallPrompt from '@/frontend/components/PwaInstallPrompt'
import AuthStatus from '@/frontend/components/auth/AuthStatus'
import GoogleAdSense from '@/frontend/components/ads/GoogleAdSense'
import GoogleAnalytics from '@/frontend/components/analytics/GoogleAnalytics'
import { getRequestLocale } from '@/server/request-locale'
import {
  getDefaultSeoCopy,
  SITE_NAME,
  SITE_URL,
} from '@/shared/seo'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const seo = getDefaultSeoCopy(locale)

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: seo.title,
      template: `%s | ${SITE_NAME}`,
    },
    description: seo.description,
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
      title: seo.title,
      description: seo.description,
      url: SITE_URL,
      siteName: SITE_NAME,
      type: 'website',
      locale: seo.ogLocale,
    },
    twitter: {
      card: 'summary',
      title: seo.title,
      description: seo.description,
    },
    other: {
      'google-adsense-account': 'ca-pub-9918770947892784',
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#071b2f',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getRequestLocale()

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-[#06100d] text-white">
        <PageScrollRestoration />
        <AppShell auth={<AuthStatus />} locale={locale}>
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
