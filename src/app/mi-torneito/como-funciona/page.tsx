import Link from 'next/link'

import { MiTorneitoRequestForm } from '@/frontend/components/mi-torneito/MiTorneitoPublicViews'
import { buildSeoMetadata } from '@/shared/seo'

type PageProps = {
  searchParams: Promise<{ solicitud?: string; mensaje?: string }>
}

export function generateMetadata() {
  return buildSeoMetadata({
    title: 'Cómo funciona Mi Torneito | Hay Fulbo',
    description: 'Información, contacto y preguntas frecuentes para publicar un torneo amateur en Hay Fulbo.',
    path: '/mi-torneito/como-funciona',
  })
}

export default async function MiTorneitoHowItWorksPage({ searchParams }: PageProps) {
  const params = await searchParams
  const feedback = params.solicitud === 'ok'
    ? { kind: 'success' as const, message: 'Solicitud enviada. Te vamos a contactar para armar el torneo.' }
    : params.solicitud === 'error'
      ? { kind: 'error' as const, message: params.mensaje || 'No se pudo enviar la solicitud.' }
      : null

  return (
    <main className="hf-mi-page hf-mi-how-page">
      <header className="hf-mi-utility-header">
        <div>
          <p className="hf-mi-kicker">Información para organizadores</p>
          <h1>Cómo funciona Mi Torneito</h1>
          <p>Publicamos el fixture, resultados, tabla y equipos; el organizador administra la información desde su panel.</p>
        </div>
        <Link href="/mi-torneito" className="hf-mi-secondary-button">Buscar torneos</Link>
      </header>

      <section className="hf-mi-section">
        <div className="hf-mi-section-head"><div><p className="hf-mi-kicker">Proceso</p><h2>Desde la solicitud hasta la publicación</h2></div></div>
        <div className="hf-mi-steps is-plain">
          {[
            'Mandás los datos principales de la competencia.',
            'Hay Fulbo revisa la solicitud y arma la estructura.',
            'Se asigna acceso al administrador responsable.',
            'El torneo queda disponible con páginas públicas para compartir.',
          ].map((text) => <article key={text}><span>{text}</span></article>)}
        </div>
      </section>

      <MiTorneitoRequestForm feedback={feedback} />

      <section className="hf-mi-section">
        <div className="hf-mi-section-head"><div><p className="hf-mi-kicker">Ayuda</p><h2>Preguntas frecuentes</h2></div></div>
        <div className="hf-mi-faq">
          <details><summary>¿Necesito una cuenta?</summary><p>Para buscar y ver torneos no. Para administrar resultados sí se requiere iniciar sesión.</p></details>
          <details><summary>¿La tabla se carga a mano?</summary><p>No. Se calcula automáticamente a partir de los resultados finalizados.</p></details>
          <details><summary>¿Cómo me contacto?</summary><p>Completá la solicitud de esta página y el equipo de Hay Fulbo responderá al email indicado.</p></details>
        </div>
      </section>
    </main>
  )
}
