import type { ReactNode } from 'react'

type TrustPageLayoutProps = {
  kicker?: string
  title: string
  summary: string
  updatedAt?: string
  children: ReactNode
}

export default function TrustPageLayout({
  kicker = 'Hay Fulbo',
  title,
  summary,
  updatedAt,
  children,
}: TrustPageLayoutProps) {
  return (
    <main className="min-w-0">
      <article className="hf-card overflow-hidden rounded-2xl text-white">
        <header className="hf-section-head px-4 py-4 sm:px-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#70ff9d]">
            {kicker}
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c8d3cf]">
            {summary}
          </p>
          {updatedAt ? (
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8d98a7]">
              Ultima actualizacion: {updatedAt}
            </p>
          ) : null}
        </header>

        <div className="space-y-7 px-4 py-5 text-sm leading-7 text-[#dbe5df] sm:px-5">
          {children}
        </div>
      </article>
    </main>
  )
}
