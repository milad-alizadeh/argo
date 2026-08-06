import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

// The right-click menu, vendored from the kit and trimmed to the rows the cockpit opens — the
// checkbox, radio and sub-menu machinery the generator ships is unused, and dead code is dead
// whether it was generated or typed. It wears the same plane and row treatment as
// `dropdown-menu`, because a menu is a menu however it was summoned.

function ContextMenu({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Root>): React.JSX.Element {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
}

function ContextMenuTrigger({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>): React.JSX.Element {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
}

/** Molecule: the floating body of an open context menu — a plane on its own depth. */
function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>): React.JSX.Element {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(
          'plane z-50 max-h-(--radix-context-menu-content-available-height) origin-(--radix-context-menu-content-transform-origin) animate-in overflow-x-hidden overflow-y-auto p-hair text-popover-foreground fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

/** Molecule: one actionable row. */
function ContextMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item>): React.JSX.Element {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-gap rounded-md px-inset py-snug outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:cursor-default data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger }
