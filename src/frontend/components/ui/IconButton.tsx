import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { classNames } from '@/frontend/components/ui/classNames'

type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> & {
  label: string
  children: ReactNode
  pressed?: boolean
  compact?: boolean
  loading?: boolean
}

export default function IconButton({
  label,
  children,
  className,
  pressed,
  compact = false,
  loading = false,
  disabled,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={classNames(
        'hf-ui-icon-button',
        compact && 'is-compact',
        pressed && 'is-pressed',
        loading && 'is-loading',
        className
      )}
      aria-label={label}
      aria-pressed={pressed}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      title={label}
    >
      <span aria-hidden="true">{children}</span>
      {loading ? <span className="hf-ui-spinner" aria-hidden="true" /> : null}
    </button>
  )
}
