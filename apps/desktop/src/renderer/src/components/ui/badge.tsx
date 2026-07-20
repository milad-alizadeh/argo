import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/lib/utils'
import { TYPE_ROLE_CLASS } from './Text'

// Labels are authored lower-case: the `tag` role uppercases them, so the accessible text
// stays what the caller wrote. `asChild` hands the children to a Slot, so the role class
// is composed from Text's map rather than wrapped.
const badgeVariants = cva(
  `inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border px-snug ${TYPE_ROLE_CLASS.tag} whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3`,
  {
    variants: {
      variant: {
        neutral: 'border-border text-foreground-faint',
        warn: 'border-status-awaiting-input/40 text-status-awaiting-input',
        primary: 'border-primary/40 bg-primary/12 text-primary-soft',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)

// Atom: the mini uppercase bordered badge — a worktree marker, an "uncommitted" flag, a
// declared intent. It labels a row, never acts: nothing here is clickable.
function Badge({
  className,
  variant = 'neutral',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
