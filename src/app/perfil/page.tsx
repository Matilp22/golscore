import ProfileForm from '@/frontend/components/profile/ProfileForm'
import { buildNoIndexMetadata } from '@/shared/seo'

export const metadata = buildNoIndexMetadata(
  'Mi Perfil | Hay Fulbo',
  'Configuración privada de la cuenta de Hay Fulbo.',
  '/perfil'
)

export default function ProfilePage() {
  return (
    <main className="hf-profile-page">
      <header className="hf-profile-hero">
        <div>
          <span className="hf-type-overline">Cuenta y preferencias</span>
          <h1>Tu lugar en Hay Fulbo</h1>
          <p>Administrá tu identidad, acceso y experiencia sin salir del partido.</p>
        </div>
        <p className="hf-profile-hero-note">
          Los favoritos de equipos quedan en este dispositivo y funcionan aunque
          cierres sesión.
        </p>
      </header>

      <ProfileForm />
    </main>
  )
}
