'use client'

export default function BackButton({ label = 'Volver' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className="inline-flex rounded-lg border border-white/8 bg-[#111418] px-3 py-2 text-sm text-[#c8d0da] transition hover:bg-[#161a20]"
    >
      {label}
    </button>
  )
}
