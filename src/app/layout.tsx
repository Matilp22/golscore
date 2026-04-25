import type { Metadata } from 'next'
import AppShell from '@/frontend/components/AppShell'
import AuthStatus from '@/frontend/components/auth/AuthStatus'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import './globals.css'

export const metadata: Metadata = {
  title: 'GolScore',
  description: 'Resultados y detalles de partidos en tiempo real',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } }

  const userLabel =
    (typeof user?.user_metadata?.username === 'string' && user.user_metadata.username) ||
    user?.email ||
    'Mi cuenta'

  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-[#0a0d0b] text-white">
        <AppShell
          auth={
            <AuthStatus
              isAuthenticated={Boolean(user)}
              userLabel={userLabel}
            />
          }
        >
          {children}
        </AppShell>
      </body>
    </html>
  )
}
