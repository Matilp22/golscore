import { Suspense } from 'react'
import AuthForm from '@/frontend/components/auth/AuthForm'
import { buildNoIndexMetadata } from '@/shared/seo'

export const metadata = buildNoIndexMetadata(
  'Iniciar Sesión | Hay Fulbo',
  'Acceso a tu cuenta de Hay Fulbo.',
  '/login'
)

export default function LoginPage() {
  return (
    <div className="min-h-screen text-white">
      <div className="mx-0 w-full max-w-none px-0 py-3 md:mx-auto md:max-w-md md:px-4 md:py-8">
        <Suspense fallback={null}>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </div>
  )
}
