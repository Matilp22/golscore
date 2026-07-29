import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { classNames } from '@/frontend/components/ui/classNames'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'quiet'
  | 'inverse'
  | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  compact?: boolean
  loading?: boolean
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

export default function Button({
  children,
  className,
  variant = 'primary',
  compact = false,
  loading = false,
  leadingIcon,
  trailingIcon,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={classNames(
        'hf-ui-button',
        `is-${variant}`,
        compact && 'is-compact',
        loading && 'is-loading',
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {leadingIcon ? (
        <span className="hf-ui-button-icon" aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      <span className="hf-ui-button-label">{children}</span>
      {trailingIcon ? (
        <span className="hf-ui-button-icon" aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}
      {loading ? <span className="hf-ui-spinner" aria-hidden="true" /> : null}
    </button>
  )
}
