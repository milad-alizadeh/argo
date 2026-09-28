import type { ReactNode } from 'react'

import { DropdownMenuTrigger } from '@/platform/renderer/components/ui/dropdown-menu'
import { InputGroupButton } from '@/platform/renderer/components/ui/input-group'

export function ComposerMenuTrigger({
  ariaLabel,
  children,
  className,
}: {
  ariaLabel: string
  children: ReactNode
  className?: string
}) {
  return (
    <DropdownMenuTrigger
      render={
        <InputGroupButton
          variant="ghost"
          className={className ?? 'shrink-0 type-control text-foreground'}
          aria-label={ariaLabel}
        />
      }
    >
      {children}
    </DropdownMenuTrigger>
  )
}
