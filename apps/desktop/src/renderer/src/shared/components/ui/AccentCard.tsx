import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Text } from './Text'

/**
 * Atom: a card fronted by a left accent rail — the shared frame behind the Delivery panel's
 * terminal milestone card and a review `FindingCard`. `tone` drives the rail colour, the wash,
 * and the ring; the eyebrow header and the body are the caller's.
 *
 * `border-l-[length:…]` keeps the rail WIDTH in the size group, not the colour group, so
 * tailwind-merge can't collapse it against the rail colour (the guard `FindingCard` first
 * needed). Tones are named for the token they spend, never a domain state — an `open` finding
 * is reported in `block` ink but acted on in `changes` ink, and the frame stays out of it.
 */
const accentCardVariants = cva(
  'grid gap-tight rounded-lg border-l-[length:var(--border-roster)] px-inset py-gap ring-1',
  {
    variants: {
      tone: {
        landed: 'border-l-tone-landed bg-inset ring-inset-hair',
        neutral: 'border-l-foreground-faint bg-inset ring-inset-hair',
        block: 'border-l-verdict-block bg-verdict-block-tint/6 ring-verdict-block-tint/25',
        changes: 'border-l-verdict-changes bg-verdict-changes-tint/6 ring-verdict-changes-tint/25',
        approve: 'border-l-verdict-approve bg-inset ring-inset-hair',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export type AccentCardTone = NonNullable<VariantProps<typeof accentCardVariants>['tone']>

export function AccentCard({
  tone,
  className,
  children,
  ...rest
}: React.ComponentProps<'div'> & VariantProps<typeof accentCardVariants>): React.JSX.Element {
  return (
    <div className={cn(accentCardVariants({ tone }), className)} {...rest}>
      {children}
    </div>
  )
}

/**
 * The card's eyebrow header row: a toned glyph + uppercase wordmark, any inline extras, then a
 * trailing cluster pushed to the right edge (a timestamp, or a meta line + action button). The
 * glyph arrives already toned; `eyebrowClassName` carries the matching tone to the word.
 */
export function AccentCardHeader({
  icon,
  eyebrow,
  eyebrowClassName,
  children,
  trailing,
}: {
  /** The leading glyph, coloured by the caller. */
  icon: React.ReactNode
  /** The uppercase wordmark — `Landed`, `Closed`, `blocking`. */
  eyebrow: React.ReactNode
  /** Tone class for the wordmark, matching the glyph. */
  eyebrowClassName?: string
  /** Inline extras that sit right after the wordmark (a line ref, a status pill). */
  children?: React.ReactNode
  /** The right-edge cluster, pushed over by a spacer when present. */
  trailing?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-gap">
      {icon}
      <Text variant="eyebrow" className={eyebrowClassName}>
        {eyebrow}
      </Text>
      {children}
      {trailing !== undefined && (
        <>
          <span className="grow" />
          {trailing}
        </>
      )}
    </div>
  )
}
