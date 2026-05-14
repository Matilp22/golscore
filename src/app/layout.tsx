import type { Metadata, Viewport } from 'next'
import AppShell from '@/frontend/components/AppShell'
import PwaInstallPrompt from '@/frontend/components/PwaInstallPrompt'
import AuthStatus from '@/frontend/components/auth/AuthStatus'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'HAY FULBO',
    template: '%s | HAY FULBO',
  },
  description: 'Resultados, fixtures y Prode con identidad futbolera.',
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
    description: 'Resultados, fixtures y Prode con identidad futbolera.',
    siteName: 'HAY FULBO',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'HAY FULBO',
    description: 'Resultados, fixtures y Prode con identidad futbolera.',
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
      </body>
    </html>
  )
}
