'use client'

import * as Sentry from '@sentry/nextjs'
import { useState } from 'react'

class SentryExampleFrontendError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SentryExampleFrontendError'
  }
}

type TestStatus = 'idle' | 'sending' | 'server-sent' | 'client-sent' | 'failed'

export default function SentryExampleClient() {
  const [status, setStatus] = useState<TestStatus>('idle')
  const [message, setMessage] = useState('')

  async function triggerSentryErrors() {
    setStatus('sending')
    setMessage('')

    const response = await fetch('/api/sentry-example-api?throw=1', {
      cache: 'no-store',
    })

    if (response.status !== 500) {
      setStatus('failed')
      setMessage('La API de prueba no devolvio el error esperado.')
      return
    }

    setStatus('server-sent')

    const error = new SentryExampleFrontendError(
      'This error is raised on the frontend of the Sentry example page.',
    )

    Sentry.captureException(error)
    setStatus('client-sent')
    setMessage('Errores de frontend y API enviados a Sentry.')
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center gap-5 px-4 py-12 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
        Sentry
      </p>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Prueba segura de errores</h1>
        <p className="max-w-xl text-sm leading-6 text-white/70">
          Esta pantalla solo existe cuando `SENTRY_TEST_ENABLED=true`. El boton
          dispara un error controlado en la API route y luego captura un error
          de frontend.
        </p>
      </div>

      <button
        type="button"
        onClick={triggerSentryErrors}
        disabled={status === 'sending'}
        className="w-fit rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#06100d] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'sending' ? 'Enviando...' : 'Enviar errores de prueba'}
      </button>

      {message ? (
        <p
          className={
            status === 'failed'
              ? 'rounded-md border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100'
              : 'rounded-md border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100'
          }
        >
          {message}
        </p>
      ) : null}
    </main>
  )
}
