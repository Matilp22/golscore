import Link from 'next/link'
import { MiTorneitoRequestForm } from '@/frontend/components/mi-torneito/MiTorneitoPublicViews'
import { buildSeoMetadata } from '@/shared/seo'

export async function generateMetadata() {
  return buildSeoMetadata({
    title: 'Solicitar Mi Torneito | Hay Fulbo',
    description: 'Solicita la creación de tu torneo amateur en Hay Fulbo.',
    path: '/mi-torneito/solicitar',
  })
}

export default function MiTorneitoRequestPage() {
  return (
    <main className="hf-mi-page">
      <section className="hf-mi-section">
        <Link href="/mi-torneito" className="hf-mi-back-link">Mi Torneito</Link>
        <p className="hf-mi-kicker">Solicitud</p>
        <h1 className="text-3xl font-black text-[#071b2f]">Crear un torneo</h1>
      </section>
      <MiTorneitoRequestForm />
    </main>
  )
}
