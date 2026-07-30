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
    <section className="hf-admin-card">
      {title || description || actions ? (
        <div className="hf-admin-card-heading">
          <div>
            {title ? (
              <h2>{title}</h2>
            ) : null}
            {description ? (
              <p>{description}</p>
            ) : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
