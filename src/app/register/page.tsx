import { Suspense } from 'react'
import AuthForm from '@/frontend/components/auth/AuthForm'
import { buildNoIndexMetadata } from '@/shared/seo'

export const metadata = buildNoIndexMetadata(
  'Crear Cuenta | Hay Fulbo',
  'Registro de cuenta para usar el Prode y las funciones de Hay Fulbo.',
  '/register'
)

export default function RegisterPage() {
  return (
    <div className="min-h-screen text-white">
      <div className="mx-0 w-full max-w-none px-0 py-3 md:mx-auto md:max-w-md md:px-4 md:py-8">
        <Suspense fallback={null}>
          <AuthForm mode="register" />
        </Suspense>
      </div>
    </div>
  )
}
