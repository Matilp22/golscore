'use client'

import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useEffect } from 'react'

export default function GlobalError({
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
    <html lang="es">
      <body className="hf-global-error-body">
        <main className="hf-system-state-page is-global-error">
          <section className="hf-system-state-hero">
            <span className="hf-system-state-code" aria-hidden="true">
              HF
            </span>
            <div className="hf-system-state-copy">
              <span className="hf-type-overline">Interrupción inesperada</span>
              <h1>No pudimos completar esta jugada.</h1>
              <p>
                El problema quedó registrado. Podés intentar de nuevo sin
                perder tu recorrido o volver al inicio.
              </p>
              <div className="hf-system-state-actions">
                <button type="button" onClick={reset}>
                  Reintentar
                </button>
                <Link href="/" className="is-secondary">
                  Volver al inicio
                </Link>
              </div>
              {error.digest ? (
                <small className="hf-system-state-reference">
                  Referencia: {error.digest}
                </small>
              ) : null}
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
