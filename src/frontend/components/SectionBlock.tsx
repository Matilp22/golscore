import { ReactNode } from 'react'

type SectionBlockProps = {
  title: string
  subtitle: string
  children: ReactNode
}

export default function SectionBlock({
  title,
  subtitle,
  children,
}: SectionBlockProps) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-white md:text-2xl">{title}</h2>
      <p className="mb-4 text-sm text-zinc-400">{subtitle}</p>
      {children}
    </section>
  )
}