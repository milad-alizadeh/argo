import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/lib/utils'
import { TYPE_ROLE_CLASS } from './Text'

// Labels are authored lower-case: the `tag` role uppercases them, so the accessible text
// stays what the caller wrote. `asChild` hands the children to a Slot, so the role class
// is composed from Text's map rather than wrapped.
// Radius and padding live in `shape` rather than here: tailwind-merge only de-dupes the
// classes it knows and the spacing roles are ours, so a shape states its whole box.
const badgeVariants = cva(
  `inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border ${TYPE_ROLE_CLASS.tag} whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3`,
  {
    variants: {
      // Named after the token spent, never what a caller reads into it — see findingState.ts.
      variant: {
        neutral: 'border-border text-foreground-faint',
        warn: 'border-tone-amber/40 text-tone-amber',
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

/**
 * Atom: the mini uppercase bordered label — a worktree marker, a declared intent, and as a
 * pill the chip that reports where something stands.
 *
 * It labels, never acts: nothing here is clickable. An icon child sits inline, sized off
 * the tag role.
 */
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
