import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { TYPE_ROLE_CLASS } from './Text'

function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>): React.JSX.Element {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(
        'inline-flex items-center gap-hair rounded-lg border border-border p-hair',
        className,
      )}
      {...props}
    />
  )
}

function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>): React.JSX.Element {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        `${TYPE_ROLE_CLASS.meta} cursor-pointer rounded-md px-gap py-tight text-muted-foreground outline-none transition-colors select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40 data-[state=on]:bg-foreground/6 data-[state=on]:text-foreground`,
        className,
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
