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
      // How the active tab is marked. `fill` washes the whole seat; `glow` seats it on a
      // washed-gold gradient pill with the cockpit's currentColor halo — a wash, not the screen's
      // one SOLID primary — for the strip that IS its band's active statement (the session
      // header). `transition-all` so the wash, the ring and the halo all fade in rather than
      // snapping.
      seat: {
        fill: 'rounded-lg data-[state=active]:bg-foreground/6',
        glow: 'rounded-lg transition-all duration-fast hover:text-foreground data-[state=active]:bg-linear-to-b data-[state=active]:from-primary/16 data-[state=active]:to-primary/4 data-[state=active]:text-primary data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-primary/25 data-[state=active]:glow data-[state=active]:glow-quiet',
        // `penumbra`: the study's own tab (`cockpit-session-interior-prototype.html` `.tab`) —
        // NO seat at all. A tab attached to the band below it is marked by a filament under it,
        // not by a pill around it: a pill is a button's shape, and a pill on a tab reads as a
        // control that could be pressed rather than as the panel you are already in.
        //
        // The filament is INSET from the tab's own edges and fades out at both ends, so it reads
        // as light falling under the word rather than as a border. That fade is the whole reason
        // it is a gradient: a flat 2px bar of the same gold is a rule, and a rule butts into its
        // neighbours. Top-rounded only, because the bottom edge is the seam it sits on.
        penumbra: [
          'relative rounded-t-lg px-region pt-gap pb-row transition-colors duration-fast',
          'hover:text-foreground data-[state=active]:text-foreground-bright',
          'after:pointer-events-none after:absolute after:inset-x-region after:bottom-0 after:h-[2px] after:rounded-full',
          'after:bg-linear-to-r after:from-transparent after:via-primary after:to-transparent',
          'after:opacity-0 after:transition-opacity after:duration-fast data-[state=active]:after:opacity-100',
          // The halo is the filament's OWN colour, set on the pseudo-element: `glow` spends
          // `currentColor`, and colouring the tab's text gold instead would gild every inactive
          // label to light one filament.
          'after:text-primary after:glow after:glow-quiet',
        ].join(' '),
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
