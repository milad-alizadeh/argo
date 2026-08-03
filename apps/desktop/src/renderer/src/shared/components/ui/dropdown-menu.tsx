import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

// The app's ONE menu primitive (the inventory's `Menu`). Vendored from the kit and trimmed
// to the rows the cockpit actually opens — the checkbox, radio and sub-menu machinery the
// generator ships is unused, and dead code is dead whether it was generated or typed.

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>): React.JSX.Element {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>): React.JSX.Element {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

/**
 * Molecule: the floating body of an open menu — a plane on its own depth.
 *
 * It sets no type role: a row's words are the caller's `Text`, so a menu row and the row it
 * mirrors elsewhere in the app can never drift apart.
 */
function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          'plane z-50 max-h-(--radix-dropdown-menu-content-available-height) origin-(--radix-dropdown-menu-content-transform-origin) animate-in overflow-x-hidden overflow-y-auto p-hair text-popover-foreground fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>): React.JSX.Element {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

/** Molecule: the eyebrow that names a group of rows. */
function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn('px-inset pt-gap pb-tight text-foreground-faint', className)}
      {...props}
    />
  )
}

/**
 * Molecule: one actionable row. A row the menu must refuse is `disabled` and states its
 * reason beside its name — never hidden, because a control that vanishes teaches nothing.
 */
function DropdownMenuItem({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  /** `destructive` spends the destructive token; it does not change what the row does. */
  variant?: 'default' | 'destructive'
}): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-gap rounded-md px-inset py-snug outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[variant=destructive]:text-destructive',
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('my-tight h-px bg-border', className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
