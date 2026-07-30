import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Página no encontrada | Hay Fulbo',
  description: 'La página que buscás no está disponible en Hay Fulbo.',
}

export default function NotFound() {
  return (
    <main className="hf-system-state-page">
      <section className="hf-system-state-hero">
        <span className="hf-system-state-code" aria-hidden="true">
          404
        </span>
        <div className="hf-system-state-copy">
          <span className="hf-type-overline">Fuera de juego</span>
          <h1>Esta página no está en la cancha.</h1>
          <p>
            Puede que el enlace haya cambiado o que el contenido ya no esté
            disponible. Tu navegación y tus favoritos siguen intactos.
          </p>
          <div className="hf-system-state-actions">
            <Link href="/">Ir a los partidos</Link>
            <Link href="/competiciones" className="is-secondary">
              Ver competiciones
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
