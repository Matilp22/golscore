import type { ReactNode } from 'react'

type AdminCardProps = {
  title?: string
  description?: string
  children: ReactNode
  actions?: ReactNode
}

export default function AdminCard({
  title,
  description,
  children,
  actions,
}: AdminCardProps) {
  return (
    <section className="hf-card rounded-2xl p-4">
      {title || description || actions ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-lg font-black text-white">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-[#9aa7b5]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
