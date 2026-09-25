import { cn } from 'cn'
import type { ComponentPropsWithoutRef } from 'react'

// The shell toggle occupies the leading edge of this row while the sidebar is collapsed. Content
// placed in the row inherits the shell's safe inset instead of having to know the toggle geometry.
export function CockpitContentChrome({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-component="CockpitContentChrome"
      className={cn(
        'drag-region flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 bg-background ps-(--inset-cockpit-content-leading) pe-(--spacing-shell-gutter)',
        className,
      )}
      {...props}
    />
  )
}
