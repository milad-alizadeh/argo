import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/lib/utils'
import { TYPE_ROLE_CLASS } from './Text'

// Labels are authored lower-case: the `tag` role uppercases them, so the accessible text
// stays what the caller wrote. `asChild` hands the children to a Slot, so the role class
// is composed from Text's map rather than wrapped.
// Radius and padding live in `shape` rather than here, for the reason CONTROL_BASE gives in
// button.tsx: a shape has to state its whole box, not override half of an inherited one.
const badgeVariants = cva(
  `inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border ${TYPE_ROLE_CLASS.tag} whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3`,
  {
    variants: {
      // Tones are named after the token they spend, never after what a caller reads into
      // them: the same wash reports one thing on a finding and another on a check.
      variant: {
        neutral: 'border-border text-foreground-faint',
        warn: 'border-status-awaiting-input/40 text-status-awaiting-input',
        primary: 'border-primary/40 bg-primary/12 text-primary-soft',
        // Verdict ink over its own tint — 40% border, 12% wash, one pair per token.
        'verdict-block': 'border-verdict-block-tint/40 bg-verdict-block-tint/12 text-verdict-block',
        'verdict-changes':
          'border-verdict-changes-tint/40 bg-verdict-changes-tint/12 text-verdict-changes',
        'verdict-approve':
          'border-verdict-approve-tint/40 bg-verdict-approve-tint/12 text-verdict-approve',
      },
      shape: {
        default: 'rounded-sm px-snug',
        // The pill sits outside the 4/6/8/12 radius family deliberately — it is what keeps
        // a chip from reading as the bordered label it travels beside.
        pill: 'rounded-full px-gap py-hair',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      shape: 'default',
    },
  },
)

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

// Atom: the mini uppercase bordered label — a worktree marker, an "uncommitted" flag, a
// declared intent, and as a pill the chip that reports where something stands. It labels,
// never acts: nothing here is clickable. An icon child sits inline, sized off the tag role.
function Badge({
  className,
  variant = 'neutral',
  shape = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    /** Style the child element instead of rendering a `<span>` — for a label that has to
     * carry its own element. */
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-shape={shape}
      className={cn(badgeVariants({ variant, shape }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
