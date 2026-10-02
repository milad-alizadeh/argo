import type { ReactNode } from 'react'

import { Icon } from '@/platform/renderer/components/icon/icon'
import { DropdownMenuTrigger } from '@/platform/renderer/components/ui/dropdown-menu'
import { InputGroupButton } from '@/platform/renderer/components/ui/input-group'
import { composerMenuTriggerRecipe } from './composer-menu-recipes'

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
          className={composerMenuTriggerRecipe(className)}
          aria-label={ariaLabel}
        />
      }
    >
      {children}
    </DropdownMenuTrigger>
  )
}

export function ComposerMenuValue({ icon, label }: { icon: ReactNode; label: ReactNode }) {
  return (
    <>
      {icon}
      <span className="hidden min-w-0 truncate @[36rem]:inline">{label}</span>
      <Icon name="chevron-down" className="hidden text-muted-foreground @[36rem]:block" />
    </>
  )
}
