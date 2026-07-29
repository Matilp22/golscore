'use client'

import { useRouter } from 'next/navigation'

export default function BackButton({
  label = 'Volver atrás',
}: {
  label?: string
}) {
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
      className="hf-back-button"
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="m14.5 5-7 7 7 7"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      <span>{label}</span>
    </button>
  )
}
