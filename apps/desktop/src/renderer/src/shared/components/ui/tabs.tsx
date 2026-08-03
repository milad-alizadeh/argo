import { cva, type VariantProps } from 'class-variance-authority'
import { Tabs as TabsPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { TYPE_ROLE_CLASS } from './Text'

/**
 * Atom: the roving-tabindex tablist — vendored shadcn on Radix `Tabs`, selection and
 * `aria-selected` wiring included free.
 */
function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>): React.JSX.Element {
  return (
    <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col', className)} {...props} />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>): React.JSX.Element {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('flex items-center gap-hair', className)}
      {...props}
    />
  )
}

// Named after the token spent, never a domain word — `changes` is the one caller (DeliveryTabs'
// Review tab) reaching for the amber wash the study spells `.dtab.review`.
const tabsTriggerVariants = cva(
  `${TYPE_ROLE_CLASS.row} cursor-pointer px-gap py-tight text-muted-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40 data-[state=active]:text-foreground`,
  {
    variants: {
      tone: {
        neutral: '',
        changes:
          'text-verdict-changes tabular-nums data-[state=active]:bg-verdict-changes-tint/12 data-[state=active]:text-verdict-changes data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-verdict-changes-tint/40',
      },
      // How the active tab is marked. `fill` washes the whole seat; `rail` underlines it in the
      // attention ink and leaves the seat unpainted, for a tab strip that sits INSIDE a band it
      // must not out-shout.
      seat: {
        fill: 'rounded-lg data-[state=active]:bg-foreground/6',
        rail: 'rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-primary',
      },
    },
    defaultVariants: { tone: 'neutral', seat: 'fill' },
  },
)

export type TabsTriggerTone = NonNullable<VariantProps<typeof tabsTriggerVariants>['tone']>

function TabsTrigger({
  className,
  tone,
  seat,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> &
  VariantProps<typeof tabsTriggerVariants>): React.JSX.Element {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ tone, seat }), className)}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>): React.JSX.Element {
  return <TabsPrimitive.Content data-slot="tabs-content" className={className} {...props} />
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabsTriggerVariants }
