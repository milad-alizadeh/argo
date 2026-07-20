import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/lib/utils'
import { TYPE_ROLE_CLASS } from './Text'
import { SOLID_PRIMARY_TONE, VERDICT_APPROVE_WASH, VERDICT_CHANGES_WASH } from './toneRecipes'

// Padding and the type role are deliberately NOT here: tailwind-merge only de-dupes the
// classes it knows, and both the spacing roles and the type roles are ours, so a `px-gap`
// or `text-meta` further down the string would land beside `px-inset` / `text-row-strong`
// instead of replacing it. Each size states the whole box, type role included — a glyph's
// box is 1em, so it tracks the control's type rather than the label's.
const CONTROL_BASE =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-snug whitespace-nowrap rounded-lg border transition-[color,background-color,border-color] duration-fast outline-none disabled:cursor-not-allowed disabled:opacity-40'

// `asChild` hands the children straight to a Slot, so a Button cannot wrap its label in
// <Text> without breaking prop merging; it composes the role class from Text's map instead.
const buttonVariants = cva(CONTROL_BASE, {
  variants: {
    // Named after the token spent, never the state a caller is in — see findingState.ts.
    variant: {
      // The gradient is the screen's ONE primary (R2) — it belongs to the head node's
      // drawer. Disabled drops the gradient: a dead control must not read as the primary.
      primary: `${SOLID_PRIMARY_TONE} disabled:border-border disabled:bg-none disabled:text-muted-foreground`,
      ghost:
        'border-border bg-transparent text-muted-foreground hover:border-input hover:text-foreground',
      // Ghost without the border: for a control that sits in a strip of its own peers
      // (console channel tabs), where a box per control would out-shout the strip. The
      // selected wash keys off `data-active`, so the state travels with the control
      // rather than as a second variant.
      quiet:
        'border-transparent bg-transparent text-muted-foreground hover:text-foreground data-[active=true]:bg-foreground/6 data-[active=true]:text-foreground',
      // Spends nothing at all — no box, no ink of its own. For a control nested inside a
      // chip its parent already paints (a console channel tab holds two), where a second
      // box would double the wash and a second colour would fight the chip's own state.
      bare: 'border-transparent bg-transparent',
      // Review-tab controls are all secondary — shipping belongs to the ribbon's gate.
      'review-secondary':
        'border-input bg-foreground/4 text-foreground-bright hover:border-primary',
      // A 55% border over a 12% wash deepening to 24% on hover: the tint carries the
      // weight the primary's gradient would, without spending the screen's one primary.
      'verdict-changes': `${VERDICT_CHANGES_WASH} text-foreground hover:border-verdict-changes-tint hover:bg-verdict-changes-tint/24`,
      'verdict-approve': `${VERDICT_APPROVE_WASH} text-foreground hover:border-verdict-approve-tint hover:bg-verdict-approve-tint/24`,
    },
    size: {
      default: `px-inset py-snug ${TYPE_ROLE_CLASS['row-strong']}`,
      // The tighter box for a control wedged into a dense strip — a console channel tab,
      // a control under a diff hunk. Denser box, denser type: the strip reads at meta.
      sm: `px-gap py-tight ${TYPE_ROLE_CLASS.meta}`,
      // No box at all — not even the ladder's 1px border, which would otherwise grow the
      // chip that already spends one. Type is inherited rather than restated, so a nested
      // control cannot drift off its chip's role.
      none: 'rounded-sm border-0 p-0',
    },
  },
  // Ghost, not primary: R2 allows one primary per screen, so a caller opts into it.
  defaultVariants: { variant: 'ghost', size: 'default' },
})

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>

/**
 * Atom: the cockpit's labelled control.
 *
 * Icon-only controls (rail header, work tabs) are their own components, not a size of
 * this one.
 */
function Button({
  className,
  variant = 'ghost',
  size = 'default',
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
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
