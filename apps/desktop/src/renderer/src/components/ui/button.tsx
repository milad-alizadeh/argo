import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/lib/utils'
import { TYPE_ROLE_CLASS } from './Text'

// Shared with AddressButton, whose verdict tones can't join a variant map the inventory
// freezes at three. The type role sits on the control itself because a glyph's box is 1em:
// it tracks the control's type, not the label's.
// Padding is deliberately NOT here: tailwind-merge only de-dupes the classes it knows, and
// the spacing roles are ours, so a `px-gap` further down the string would land beside
// `px-inset` instead of replacing it. Each control states its own box.
export const CONTROL_BASE = `inline-flex shrink-0 cursor-pointer items-center justify-center gap-snug whitespace-nowrap rounded-lg border ${TYPE_ROLE_CLASS['row-strong']} transition-[color,background-color,border-color] duration-fast outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40`

// `asChild` hands the children straight to a Slot, so a Button cannot wrap its label in
// <Text> without breaking prop merging; it composes the role class from Text's map instead.
const buttonVariants = cva(`${CONTROL_BASE} px-inset py-snug`, {
  variants: {
    variant: {
      // The gradient is the screen's ONE primary (R2) — it belongs to the head node's
      // drawer. Disabled drops the gradient: a dead control must not read as the primary.
      primary:
        'border-primary/55 bg-linear-to-br from-primary-bright to-primary text-primary-foreground disabled:border-border disabled:bg-none disabled:text-muted-foreground',
      ghost:
        'border-border bg-transparent text-muted-foreground hover:border-input hover:text-foreground',
      // Review-tab controls are all secondary — shipping belongs to the ribbon's gate.
      'review-secondary':
        'border-input bg-foreground/4 text-foreground-bright hover:border-primary',
    },
  },
  // Ghost, not primary: R2 allows one primary per screen, so a caller opts into it.
  defaultVariants: { variant: 'ghost' },
})

// Atom: the cockpit's labelled control. Three variants and one size — icon-only controls
// (rail header, work tabs) are their own components, not a size of this one.
function Button({
  className,
  variant = 'ghost',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Style the child element instead of rendering a `<button>` — for a control that has
     * to be a link or a menu item. */
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
