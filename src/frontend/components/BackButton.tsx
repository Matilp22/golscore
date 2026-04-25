'use client'

import { useRouter } from 'next/navigation'

export default function BackButton({ label = 'Volver atrás' }: { label?: string }) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back()
          return
        }

        router.push('/')
      }}
      className="inline-flex min-h-10 items-center rounded-lg border border-white/8 bg-[#111418] px-3 py-2 text-sm font-semibold text-[#c8d0da] transition hover:bg-[#161a20] hover:text-white"
    >
      {label}
    </button>
  )
}
