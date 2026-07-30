'use client'

import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="hf-system-state-page">
      <section className="hf-system-state-hero">
        <span className="hf-system-state-code" aria-hidden="true">
          !
        </span>
        <div className="hf-system-state-copy">
          <span className="hf-type-overline">Datos interrumpidos</span>
          <h1>Esta sección no pudo cargar.</h1>
          <p>
            Podés reintentar la consulta. Si el problema continúa, el resto de
            Hay Fulbo sigue disponible y el error ya quedó registrado.
          </p>
          <div className="hf-system-state-actions">
            <button type="button" onClick={reset}>
              Reintentar
            </button>
            <Link href="/" className="is-secondary">
              Volver a partidos
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
