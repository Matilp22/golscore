import type { Metadata, Viewport } from 'next'
import AppShell from '@/frontend/components/AppShell'
import PwaInstallPrompt from '@/frontend/components/PwaInstallPrompt'
import AuthStatus from '@/frontend/components/auth/AuthStatus'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'FulboApp',
    template: '%s | FulboApp',
  },
  description: 'app de resultados y prode',
  manifest: '/manifest.json',
  applicationName: 'FulboApp',
  appleWebApp: {
    capable: true,
    title: 'FulboApp',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  openGraph: {
    title: 'FulboApp',
    description: 'app de resultados y prode',
    siteName: 'FulboApp',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'FulboApp',
    description: 'app de resultados y prode',
  },
}

export const viewport: Viewport = {
  themeColor: '#0d1014',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-[#0a0d0b] text-white">
        <AppShell auth={<AuthStatus />}>
          {children}
        </AppShell>
        <PwaInstallPrompt />
      </body>
    </html>
  )
}
