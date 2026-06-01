import ProfileForm from '@/frontend/components/profile/ProfileForm'
import { buildNoIndexMetadata } from '@/shared/seo'

export const metadata = buildNoIndexMetadata(
  'Mi Perfil | Hay Fulbo',
  'Configuración privada de la cuenta de Hay Fulbo.',
  '/perfil'
)

export default function ProfilePage() {
  return (
    <main className="min-w-0 space-y-4">
      <header className="hf-hero overflow-hidden rounded-3xl px-4 py-5 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7ff0b2]">
          Cuenta
        </p>
        <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">
          Mi perfil
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#8d98a7]">
          Editá tu usuario, email y contraseña sin cerrar tu sesión actual.
        </p>
      </header>

      <ProfileForm />
    </main>
  )
}
