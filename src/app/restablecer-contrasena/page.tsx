import ResetPasswordForm from '@/frontend/components/auth/ResetPasswordForm'
import { buildNoIndexMetadata } from '@/shared/seo'

export const metadata = buildNoIndexMetadata(
  'Restablecer contraseña | Hay Fulbo',
  'Creá una nueva contraseña para tu cuenta de Hay Fulbo.',
  '/restablecer-contrasena'
)

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen text-white">
      <div className="mx-0 w-full max-w-none px-0 py-3 md:mx-auto md:max-w-md md:px-4 md:py-8">
        <ResetPasswordForm />
      </div>
    </div>
  )
}
