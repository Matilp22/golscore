import type { Metadata } from 'next'
import AppShell from '@/frontend/components/AppShell'
import AuthStatus from '@/frontend/components/auth/AuthStatus'
import './globals.css'

export const metadata: Metadata = {
  title: 'GolScore',
  description: 'Resultados y detalles de partidos en tiempo real',
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
      </body>
    </html>
  )
}
