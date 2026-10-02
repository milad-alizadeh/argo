import { cn } from 'cn'
import type { ComponentPropsWithoutRef } from 'react'

// The shell toggle occupies the leading edge of this row while the sidebar is collapsed. Content
// placed in the row inherits the shell's safe inset instead of having to know the toggle geometry.
export function WorkspaceContentChrome({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-component="WorkspaceContentChrome"
      className={cn(
        'panel-window-chrome ps-(--inset-shell-content-leading) pe-(--spacing-shell-gutter)',
        className,
      )}
      {...props}
    />
  )
}
