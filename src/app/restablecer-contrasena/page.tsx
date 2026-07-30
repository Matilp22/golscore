import ResetPasswordForm from '@/frontend/components/auth/ResetPasswordForm'
import AuthFrame from '@/frontend/components/auth/AuthFrame'
import { buildNoIndexMetadata } from '@/shared/seo'

export const metadata = buildNoIndexMetadata(
  'Restablecer contraseña | Hay Fulbo',
  'Creá una nueva contraseña para tu cuenta de Hay Fulbo.',
  '/restablecer-contrasena'
)

export default function ResetPasswordPage() {
  return (
    <AuthFrame context="recovery">
      <ResetPasswordForm />
    </AuthFrame>
  )
}
