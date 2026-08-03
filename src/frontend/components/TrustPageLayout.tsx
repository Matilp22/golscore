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
    <main className="hf-trust-page">
      <article className="hf-trust-card">
        <header className="hf-trust-hero">
          <p className="hf-type-overline">{kicker}</p>
          <h1>{title}</h1>
          <p>{summary}</p>
          {updatedAt ? (
            <p className="hf-trust-updated">
              Ultima actualizacion: {updatedAt}
            </p>
          ) : null}
        </header>

        <div className="hf-trust-body">{children}</div>
      </article>
    </main>
  )
}
