import { cn } from '@/lib/utils'
import { Button, FOCUS_RING, Text } from '@/shared/components/ui'
import type { IconAtom } from '@/shared/components/ui/icons'

/**
 * Molecule: the rail's quiet full-width action row — a glyph and a label, and nothing else.
 *
 * Both of the rail's permanent affordances are this shape (`+ New session` at the top,
 * `⚙ Archived (n)` at the foot), so it is one molecule with two labels rather than the same twelve
 * utilities written twice. Deliberately quiet: it has no plane, no fill and no accent, because
 * neither affordance is an event and a permanent button shouting for attention would spend the one
 * channel gold owns. `size="none"` is what drops the primitive's box entirely — the ladder's 1px
 * border would otherwise draw a frame around a row that is supposed to have none.
 */
export function RailActionRow({
  icon: Icon,
  label,
  className,
  ...button
}: React.ComponentProps<'button'> & {
  /** The row's glyph, in the rail's one icon size. */
  icon: IconAtom
  /** What the row does, read by the user and used as its accessible name. */
  label: string
}): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="quiet"
      size="none"
      className={cn(
        'w-full justify-start rounded-lg px-region py-row text-left text-foreground-faint hover:bg-accent hover:text-foreground',
        FOCUS_RING,
        className,
      )}
      {...button}
    >
      <Icon aria-hidden className="icon-sm" />
      <Text variant="row">{label}</Text>
    </Button>
  )
}
