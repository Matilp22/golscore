import { Suspense } from 'react'
import AuthForm from '@/frontend/components/auth/AuthForm'
import AuthFrame from '@/frontend/components/auth/AuthFrame'
import { buildNoIndexMetadata } from '@/shared/seo'

export const metadata = buildNoIndexMetadata(
  'Iniciar Sesión | Hay Fulbo',
  'Acceso a tu cuenta de Hay Fulbo.',
  '/login'
)

export default function LoginPage() {
  return (
    <AuthFrame context="login">
      <Suspense fallback={<div className="hf-account-card-skeleton" aria-label="Cargando acceso" />}>
        <AuthForm mode="login" />
      </Suspense>
    </AuthFrame>
  )
}
