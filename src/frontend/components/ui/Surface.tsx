import type { HTMLAttributes, ReactNode } from 'react'

import { classNames } from '@/frontend/components/ui/classNames'

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  tone?: 'default' | 'raised' | 'sunken' | 'inverse'
  padding?: 'none' | 'compact' | 'default' | 'roomy'
}

export default function Surface({
  children,
  className,
  tone = 'default',
  padding = 'default',
  ...props
}: SurfaceProps) {
  return (
    <div
      {...props}
      className={classNames(
        'hf-ui-surface',
        `is-${tone}`,
        `has-${padding}-padding`,
        className
      )}
    >
      {children}
    </div>
  )
}
