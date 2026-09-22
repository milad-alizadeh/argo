import { cn } from 'cn'
import type * as React from 'react'
import './loader.css'

export type LoaderSize = 'meta' | 'control' | 'standard' | 'prominent'

type LoaderAccessibility =
  | { 'aria-hidden': true; 'aria-label'?: never }
  | { 'aria-hidden'?: false; 'aria-label': string }

export type LoaderProps = Omit<
  React.ComponentPropsWithoutRef<'span'>,
  'aria-hidden' | 'aria-label' | 'children' | 'role'
> &
  LoaderAccessibility & {
    size?: LoaderSize
  }

export function Loader({ className, size = 'control', ...props }: LoaderProps) {
  const hidden = props['aria-hidden'] === true
  return (
    <span
      className={cn('loader', className)}
      data-size={size}
      data-slot="loader"
      role={hidden ? undefined : 'status'}
      {...props}
    />
  )
}
