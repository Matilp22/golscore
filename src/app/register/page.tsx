import { Suspense } from 'react'
import AuthForm from '@/frontend/components/auth/AuthForm'
import AuthFrame from '@/frontend/components/auth/AuthFrame'
import { buildNoIndexMetadata } from '@/shared/seo'

export const metadata = buildNoIndexMetadata(
  'Crear Cuenta | Hay Fulbo',
  'Registro de cuenta para usar el Prode y las funciones de Hay Fulbo.',
  '/register'
)

export default function RegisterPage() {
  return (
    <AuthFrame context="register">
      <Suspense fallback={<div className="hf-account-card-skeleton" aria-label="Cargando registro" />}>
        <AuthForm mode="register" />
      </Suspense>
    </AuthFrame>
  )
}
