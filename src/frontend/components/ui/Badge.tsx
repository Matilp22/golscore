import type { HTMLAttributes, ReactNode } from 'react'

import { classNames } from '@/frontend/components/ui/classNames'

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'live'
  | 'finished'
  | 'scheduled'
  | 'warning'
  | 'danger'
  | 'success'
  | 'info'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
  icon?: ReactNode
}

export default function Badge({
  children,
  className,
  tone = 'neutral',
  icon,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={classNames('hf-ui-badge', `is-${tone}`, className)}
    >
      {icon ? (
        <span className="hf-ui-badge-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </span>
  )
}
