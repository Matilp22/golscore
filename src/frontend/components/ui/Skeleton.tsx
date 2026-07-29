import type { CSSProperties, HTMLAttributes } from 'react'

import { classNames } from '@/frontend/components/ui/classNames'

type SkeletonProps = HTMLAttributes<HTMLSpanElement> & {
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  rounded?: boolean
}

export default function Skeleton({
  className,
  width,
  height,
  rounded = false,
  style,
  ...props
}: SkeletonProps) {
  return (
    <span
      {...props}
      className={classNames(
        'hf-ui-skeleton',
        rounded && 'is-rounded',
        className
      )}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  )
}
