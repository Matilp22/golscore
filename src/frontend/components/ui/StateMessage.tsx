import type { ReactNode } from 'react'

import { classNames } from '@/frontend/components/ui/classNames'

type StateMessageProps = {
  title: string
  description?: string
  action?: ReactNode
  className?: string
  tone?: 'empty' | 'error' | 'offline' | 'permission' | 'info'
  live?: 'polite' | 'assertive' | 'off'
}

function StateIcon({ tone }: { tone: NonNullable<StateMessageProps['tone']> }) {
  if (tone === 'error' || tone === 'offline') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 2.8 20h18.4L12 3Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M12 9v5m0 3h.01" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    )
  }

  if (tone === 'permission') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 10V8a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v6m0-10h.01" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

export default function StateMessage({
  title,
  description,
  action,
  className,
  tone = 'empty',
  live = 'polite',
}: StateMessageProps) {
  return (
    <div
      className={classNames('hf-ui-state', `is-${tone}`, className)}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={live}
    >
      <span className="hf-ui-state-icon">
        <StateIcon tone={tone} />
      </span>
      <div className="hf-ui-state-copy">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="hf-ui-state-action">{action}</div> : null}
    </div>
  )
}
