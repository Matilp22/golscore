"use client"

import * as Sentry from "@sentry/nextjs"

export default function SentryTestPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <button
        type="button"
        onClick={() => {
          Sentry.captureException(new Error("Sentry frontend manual test"))
          throw new Error("Sentry frontend manual test")
        }}
        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
      >
        Probar error frontend Sentry
      </button>
    </main>
  )
}
